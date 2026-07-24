const Agreement = require('../models/Agreement');
const Client = require('../models/Client');

// @desc    Get current agreement
// @route   GET /api/client/agreement
// @access  Private (Client/Admin)
const getAgreement = async (req, res) => {
  try {
    const agreement = await Agreement.findOne().sort({ version: -1 });
    if (!agreement) {
      return res.status(404).json({ message: 'No agreement found' });
    }
    res.status(200).json(agreement);
  } catch (error) {
    console.error('Error fetching agreement:', error);
    res.status(500).json({ message: 'Server error fetching agreement' });
  }
};

// @desc    Create or update agreement
// @route   PUT /api/admin/agreement
// @access  Private (Admin)
const updateAgreement = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Agreement content is required' });
    }

    let agreement = await Agreement.findOne().sort({ version: -1 });
    
    if (agreement) {
      // If content is same, do not create a new version
      if (agreement.content === content) {
        return res.status(200).json(agreement);
      }
      
      // Create new version
      const newAgreement = await Agreement.create({
        content,
        version: agreement.version + 1,
        updatedBy: req.user._id
      });
      return res.status(200).json(newAgreement);
    } else {
      // First agreement
      const newAgreement = await Agreement.create({
        content,
        version: 1,
        updatedBy: req.user._id
      });
      return res.status(201).json(newAgreement);
    }
  } catch (error) {
    console.error('Error updating agreement:', error);
    res.status(500).json({ message: 'Server error updating agreement' });
  }
};

// @desc    Client accept agreement
// @route   POST /api/client/accept-agreement
// @access  Private (Client)
const acceptAgreement = async (req, res) => {
  try {
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({ message: 'Agreement version is required' });
    }

    const client = await Client.findById(req.client._id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.acceptedAgreementVersion = version;
    client.agreementAcceptedAt = Date.now();
    await client.save();

    res.status(200).json({ 
      message: 'Agreement accepted successfully',
      acceptedAgreementVersion: client.acceptedAgreementVersion 
    });
  } catch (error) {
    console.error('Error accepting agreement:', error);
    res.status(500).json({ message: 'Server error accepting agreement' });
  }
};

module.exports = {
  getAgreement,
  updateAgreement,
  acceptAgreement
};
