const PresenceHeader = require('../models/PresenceHeader');
const PresenceLocation = require('../models/PresenceLocation');

// Get all presence data (Public)
exports.getPresencePublic = async (req, res) => {
  try {
    let header = await PresenceHeader.findOne();
    if (!header) {
      header = await PresenceHeader.create({});
    }
    const locations = await PresenceLocation.find().sort({ createdAt: 1 });
    
    res.json({ header, locations });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// Get presence data (Admin - though could be same as public)
exports.getPresenceAdmin = async (req, res) => {
  try {
    let header = await PresenceHeader.findOne();
    if (!header) {
      header = await PresenceHeader.create({});
    }
    const locations = await PresenceLocation.find().sort({ createdAt: 1 });
    
    res.json({ header, locations });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// Update header
exports.updatePresenceHeader = async (req, res) => {
  try {
    const { titlePrefix, highlightedWord, description } = req.body;
    let header = await PresenceHeader.findOne();
    
    if (!header) {
      header = await PresenceHeader.create({ titlePrefix, highlightedWord, description });
    } else {
      header.titlePrefix = titlePrefix;
      header.highlightedWord = highlightedWord;
      header.description = description;
      await header.save();
    }
    
    res.json({ message: 'Header updated successfully', header });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// Create a location
exports.createPresenceLocation = async (req, res) => {
  try {
    const { name, top, left, delay } = req.body;
    const location = await PresenceLocation.create({ name, top, left, delay });
    res.status(201).json({ message: 'Location created successfully', location });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// Update a location
exports.updatePresenceLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, top, left, delay } = req.body;
    
    const location = await PresenceLocation.findByIdAndUpdate(
      id,
      { name, top, left, delay },
      { new: true, runValidators: true }
    );
    
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    
    res.json({ message: 'Location updated successfully', location });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// Delete a location
exports.deletePresenceLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const location = await PresenceLocation.findByIdAndDelete(id);
    
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    
    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};
