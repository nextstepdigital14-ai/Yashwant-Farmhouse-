import express from 'express';
import SiteSetting from '../models/SiteSetting.js';
import Price from '../models/Price.js';
import Availability from '../models/Availability.js';
import Gallery from '../models/Gallery.js';
import Enquiry from '../models/Enquiry.js';
import { isDBConnected } from '../config/db.js';
import { persistentStore } from '../store/memoryStore.js';

const router = express.Router();

// GET /api/public/data - Dynamic content directly from the database for the public website
router.get('/data', async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  try {
    let settings = null;
    let prices = null;
    let availabilityMap = {};
    let gallery = null;

    if (isDBConnected()) {
      try {
        const [dbSettings, dbPrices, dbAvailability, dbGallery] = await Promise.all([
          SiteSetting.findOne(),
          Price.find({ active: true }).sort({ order: 1, createdAt: 1 }),
          Availability.find().select('date status guestCount notes -_id'),
          Gallery.find().sort({ featured: -1, order: 1, createdAt: -1 })
        ]);

        if (dbSettings) settings = dbSettings;
        if (dbPrices) prices = dbPrices;
        if (dbGallery) gallery = dbGallery;

        if (dbAvailability) {
          dbAvailability.forEach(item => {
            availabilityMap[item.date] = item.status;
          });
        }
      } catch (dbErr) {
        console.warn('[Public API] DB read failed, using persistent store:', dbErr.message);
      }
    }

    // Only fallback to persistent disk store if MongoDB query failed or is disconnected
    if (settings === null) settings = persistentStore.getSettings();
    if (prices === null) prices = persistentStore.getPrices().filter(p => p.active !== false);
    if (gallery === null) gallery = persistentStore.getGallery();

    if (!isDBConnected() && Object.keys(availabilityMap).length === 0) {
      const diskAvail = persistentStore.getAvailability();
      Object.entries(diskAvail).forEach(([d, val]) => {
        availabilityMap[d] = typeof val === 'string' ? val : val.status;
      });
    }

    res.json({
      success: true,
      data: {
        settings,
        prices,
        availability: availabilityMap,
        gallery,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Public API] Error in /api/public/data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve site data'
    });
  }
});

// POST /api/public/enquiry - Customer submits booking enquiry
router.post('/enquiry', async (req, res) => {
  try {
    const { name, phone, email, date, guests, message } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone number are required.'
      });
    }

    const enquiryData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      preferredDate: date || '',
      guests: guests || '1-5',
      message: message ? message.trim() : '',
      status: 'new'
    };

    let enquiryId = null;

    if (isDBConnected()) {
      try {
        const enquiry = await Enquiry.create(enquiryData);
        enquiryId = enquiry._id;
      } catch (dbErr) {
        console.warn('[Public API] DB enquiry create failed, using persistent store:', dbErr.message);
      }
    }

    const diskEnq = persistentStore.addEnquiry({
      ...(enquiryId ? { _id: enquiryId.toString() } : {}),
      ...enquiryData
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully! The farmhouse team will contact you shortly.',
      enquiryId: enquiryId || diskEnq._id
    });
  } catch (error) {
    console.error('[Public API] Error submitting enquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit enquiry. Please try again or WhatsApp us directly.'
    });
  }
});

export default router;
