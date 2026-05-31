import express from 'express';
import Folder from '../models/Folder.js';
import Resource from '../models/Resource.js';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import { createRequire } from 'module';
import { verifyToken, validateObjectId } from '../middleware/auth.js';
const require = createRequire(import.meta.url);
const archiver = require('archiver');

const router = express.Router();

// Get all public folders
router.get('/public', async (req, res) => {
  try {
    const { category } = req.query;

    const query = { isPublic: true };

    if (category) {
      query.category = category;
    }

    const folders = await Folder.find(query)
      .populate('createdBy', 'name')
      .sort({ resourceCount: -1, createdAt: -1 });

    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get root folders only
router.get('/root', async (req, res) => {
  try {
    const { category } = req.query;

    const matchQuery = {
      parentFolder: null,
      isPublic: true
    };

    if (category) {
      matchQuery.category = category;
    }

    const subfolderMatch = category
      ? {
          $and: [
            { $eq: ["$parentFolder", "$$folderId"] },
            { $eq: ["$category", category] }
          ]
        }
      : {
          $eq: ["$parentFolder", "$$folderId"]
        };

    const folders = await Folder.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "folders",
          let: { folderId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: subfolderMatch
              }
            }
          ],
          as: "subfolders"
        }
      },
      {
        $addFields: {
          subfolderCount: { $size: "$subfolders" }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all folders
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category } = req.query;

    const query = {};

    if (category) {
      query.category = category;
    }

    const folders = await Folder.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's own folders
router.get('/my-folders', verifyToken, async (req, res) => {
  try {
    const { category } = req.query;

    const query = { createdBy: req.userId };

    if (category) {
      query.category = category;
    }

    const folders = await Folder.find(query)
      .sort({ createdAt: -1 });

    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new folder
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, isPublic, parentFolder, category } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const folder = new Folder({
      name: name.trim(),
      description: description || '',
      category: category || 'CSE',
      createdBy: req.userId,
      isPublic: isPublic !== undefined ? isPublic : true,
      parentFolder: parentFolder || null
    });

    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    console.error('folder create error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update folder (owner or admin)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, description, isPublic, category } = req.body;
    const updateData = {};
    if (name        !== undefined) updateData.name        = String(name).trim();
    if (description !== undefined) updateData.description = String(description).trim();
    if (isPublic    !== undefined) updateData.isPublic    = isPublic;
    if (category    !== undefined) updateData.category    = String(category).trim();
    // Admin can edit any folder; others only their own
    const filter = req.userRole === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, createdBy: req.userId };
    const folder = await Folder.findOneAndUpdate(filter, updateData, { new: true });
    if (!folder) return res.status(404).json({ message: 'Folder not found or unauthorized' });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete folder admin only — unlinks orphaned resources and subfolders
router.delete('/:id', verifyToken, validateObjectId('id'), async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    await Promise.all([
      // Null-out folder reference so resources become accessible as "unfiled"
      Resource.updateMany({ folder: req.params.id }, { $unset: { folder: '' } }),
      // Move child subfolders to root (no parent)
      Folder.updateMany({ parentFolder: req.params.id }, { $unset: { parentFolder: '' } }),
      // Delete the folder itself
      Folder.findByIdAndDelete(req.params.id),
    ]);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('[folder delete]', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download all resources in a folder as a ZIP
// Requires auth; only public folders or owner/admin can download
router.get('/:id/download-zip', verifyToken, validateObjectId('id'), async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const isOwner = folder.createdBy?.toString() === req.userId;
    const isAdmin = req.userRole === 'admin';
    if (!folder.isPublic && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const resources = await Resource.find({ folder: req.params.id, status: 'approved' });
    if (!resources.length) {
      return res.status(404).json({ message: 'No approved resources in this folder' });
    }

    const safeName = folder.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'folder';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { if (!res.headersSent) res.status(500).end(); });
    archive.pipe(res);

    for (const resource of resources) {
      try {
        // Use fl_attachment URL so Cloudinary serves the raw file
        let fileUrl = resource.fileUrl;
        if (resource.fileType?.startsWith('image/')) {
          fileUrl = fileUrl.replace('/image/upload/', '/image/upload/fl_attachment/');
        } else {
          fileUrl = fileUrl.replace('/raw/upload/', '/raw/upload/fl_attachment/');
        }

        const response = await fetch(fileUrl);
        if (!response.ok) continue;

        const fileName = resource.fileName || `${resource.title}.bin`;
        archive.append(response.body, { name: fileName });
      } catch {
        // Skip files that fail to fetch
      }
    }

    await archive.finalize();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: 'Server error' });
  }
});

// Get subfolders of a folder
router.get('/parent/:id', async (req, res) => {
  try {
    const { category } = req.query;

    const matchQuery = {
      parentFolder: new mongoose.Types.ObjectId(req.params.id),
      isPublic: true
    };

    if (category) {
      matchQuery.category = category;
    }

    const subfolderMatch = category
      ? {
          $and: [
            { $eq: ["$parentFolder", "$$folderId"] },
            { $eq: ["$category", category] }
          ]
        }
      : {
          $eq: ["$parentFolder", "$$folderId"]
        };

    const folders = await Folder.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "folders",
          let: { folderId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: subfolderMatch
              }
            }
          ],
          as: "subfolders"
        }
      },
      {
        $addFields: {
          subfolderCount: { $size: "$subfolders" }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
