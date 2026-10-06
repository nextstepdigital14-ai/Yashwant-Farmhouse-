import express from 'express';
import mongoose from 'mongoose';
import Price from '../models/Price.js';
import { authMiddleware } from '../middleware/auth.js';
import { isDBConnected } from '../config/db.js';
import { persistentStore } from '../store/memoryStore.js';

const router = express.Router();

// Helper to check valid ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/prices - List all prices
router.get('/', async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  try {
    if (isDBConnected()) {
      try {
        const prices = await Price.find().sort({ order: 1, createdAt: 1 });
        // Keep persistent store in sync
        persistentStore.data.prices = prices.map(p => ({
          ...p.toObject(),
          _id: p._id.toString()
        }));
        persistentStore.save();

        return res.json({ success: true, prices });
      } catch (e) {
        console.warn('[Prices API] DB find failed, using persistent store:', e.message);
      }
    }

    res.json({
      success: true,
      prices: persistentStore.getPrices()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/prices - Create price
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, category, amount, unit, description, badge, features, active } = req.body;

    if (!title || !category || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, and amount are required.'
      });
    }

    const priceData = {
      title: title.trim(),
      category: category.trim(),
      amount: Number(amount),
      unit: unit || 'per night',
      description: description || '',
      badge: badge || '',
      features: Array.isArray(features) ? features : (features ? [features] : []),
      active: active !== undefined ? Boolean(active) : true
    };

    let price = null;

    if (isDBConnected()) {
      try {
        price = await Price.create(priceData);
      } catch (e) {
        console.warn('[Prices API] DB price create failed:', e.message);
      }
    }

    // Always update persistent disk store
    const diskPrice = persistentStore.addPrice({
      ...(price ? { _id: price._id.toString() } : {}),
      ...priceData
    });

    res.status(201).json({
      success: true,
      message: 'Price category created successfully.',
      price: price || diskPrice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/prices/:id - Update price (Permanent Persistence Guaranteed)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, category, amount, unit, description, badge, features, active } = req.body;
    const priceId = req.params.id;

    let updated = null;

    if (isDBConnected()) {
      try {
        let price = null;
        if (isValidId(priceId)) {
          price = await Price.findById(priceId);
        }

        // Fallback: match by title if not found by id
        if (!price && title) {
          price = await Price.findOne({
            title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }
          });
        }

        if (price) {
          if (title !== undefined) price.title = title.trim();
          if (category !== undefined) price.category = category.trim();
          if (amount !== undefined) price.amount = Number(amount);
          if (unit !== undefined) price.unit = unit;
          if (description !== undefined) price.description = description;
          if (badge !== undefined) price.badge = badge;
          if (features !== undefined) price.features = Array.isArray(features) ? features : [features];
          if (active !== undefined) price.active = Boolean(active);
          await price.save();
          updated = price;
        } else {
          // If price did not exist in DB yet, create it once
          updated = await Price.create({
            title: (title || 'New Price').trim(),
            category: (category || 'Stay').trim(),
            amount: Number(amount) || 0,
            unit: unit || 'per night',
            description: description || '',
            badge: badge || '',
            features: Array.isArray(features) ? features : [features],
            active: active !== undefined ? Boolean(active) : true
          });
        }
      } catch (e) {
        console.warn('[Prices API] DB price update failed:', e.message);
      }
    }

    // Always update persistent disk store
    const updatePayload = {
      ...(title !== undefined && { title: title.trim() }),
      ...(category !== undefined && { category: category.trim() }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(unit !== undefined && { unit }),
      ...(description !== undefined && { description }),
      ...(badge !== undefined && { badge }),
      ...(features !== undefined && { features: Array.isArray(features) ? features : [features] }),
      ...(active !== undefined && { active: Boolean(active) })
    };

    const diskUpdated = persistentStore.updatePrice(
      updated ? updated._id.toString() : priceId,
      updatePayload
    );

    const result = updated || diskUpdated;

    if (!result) {
      return res.status(404).json({ success: false, message: 'Price item not found.' });
    }

    res.json({
      success: true,
      message: 'Price updated successfully.',
      price: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/prices/:id/toggle - Toggle active status
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    let price = null;
    const priceId = req.params.id;

    if (isDBConnected()) {
      try {
        if (isValidId(priceId)) {
          price = await Price.findById(priceId);
        }
        if (price) {
          price.active = !price.active;
          await price.save();
        }
      } catch (e) {
        console.warn('[Prices API] DB price toggle failed:', e.message);
      }
    }

    const diskPrice = persistentStore.togglePrice(priceId);

    const result = price || diskPrice;
    if (!result) {
      return res.status(404).json({ success: false, message: 'Price category not found.' });
    }

    res.json({
      success: true,
      message: `Price "${result.title}" is now ${result.active ? 'Active' : 'Disabled'}.`,
      price: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/prices/:id - Delete price
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    let deleted = null;
    const priceId = req.params.id;

    if (isDBConnected()) {
      try {
        if (isValidId(priceId)) {
          deleted = await Price.findByIdAndDelete(priceId);
        }
      } catch (e) {
        console.warn('[Prices API] DB price delete failed:', e.message);
      }
    }

    const diskDeleted = persistentStore.deletePrice(priceId);

    if (!deleted && !diskDeleted) {
      return res.status(404).json({ success: false, message: 'Price category not found.' });
    }

    res.json({
      success: true,
      message: 'Price category deleted successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
