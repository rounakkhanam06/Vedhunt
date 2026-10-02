const Agreement = require('../models/Agreement');
const Client = require('../models/Client');
const {
  isAgreementConfigured,
  requiredAgreementVersion,
} = require('../services/agreementVersioning');

const getGlobalAgreement = () => Agreement.findOne().sort({ version: -1 });

// @desc    Get current agreement
// @route   GET /api/admin/agreement
// @access  Private (Admin)
const getAgreement = async (req, res) => {
  try {
    const agreement = await getGlobalAgreement();
    if (!agreement) {
      return res.status(404).json({ message: 'No agreement found' });
    }
    res.status(200).json(agreement);
  } catch (error) {
    console.error('Error fetching agreement:', error);
    res.status(500).json({ message: 'Server error fetching agreement' });
  }
};

// @desc    Get the logged-in client's agreement: the common template is rendered
//          client-side from these details (current, and the signed snapshot)
// @route   GET /api/client/agreement
// @access  Private (Client)
const getClientAgreement = async (req, res) => {
  try {
    const [client, globalAgreement] = await Promise.all([
      Client.findById(req.client._id).lean(),
      getGlobalAgreement(),
    ]);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const version = requiredAgreementVersion(client, globalAgreement?.version || 0);
    const accepted = client.acceptedAgreementVersion || 0;
    const signed = client.signedAgreement?.version && client.signedAgreement.version === accepted
      ? client.signedAgreement
      : null;

    res.status(200).json({
      // `version` is what ClientLayout compares acceptedAgreementVersion against
      version,
      available: isAgreementConfigured(client),
      content: globalAgreement?.content || null,
      client: {
        businessName: client.businessName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
        agreementDetails: client.agreementDetails || {},
        acceptedAgreementVersion: accepted,
        agreementAcceptedAt: client.agreementAcceptedAt || null,
      },
      signed,
    });
  } catch (error) {
    console.error('Error fetching client agreement:', error);
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

    let agreement = await getGlobalAgreement();
    
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

    const globalAgreement = await getGlobalAgreement();
    const required = requiredAgreementVersion(client, globalAgreement?.version || 0);
    if (!required) {
      return res.status(400).json({ message: 'Your agreement is still being prepared.' });
    }
    // The admin may have changed the details while the client was reading —
    // never record acceptance of a version other than the one now in force.
    if (Number(version) !== required) {
      return res.status(409).json({
        message: 'The agreement was updated. Please review the latest version.',
        version: required,
      });
    }

    const acceptedAt = new Date();
    client.acceptedAgreementVersion = required;
    client.agreementAcceptedAt = acceptedAt;
    client.signedAgreement = {
      version: required,
      acceptedAt,
      businessName: client.businessName,
      contactName: client.contactName,
      phone: client.phone,
      details: client.toObject().agreementDetails || {},
    };
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
  getClientAgreement,
  updateAgreement,
  acceptAgreement
};
