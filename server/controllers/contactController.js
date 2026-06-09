const sendEmail = require('../utils/sendEmail');

exports.submitContactForm = async (req, res) => {
  try {
    const { firstName, lastName, email, message } = req.body;

    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const hrEmail = process.env.HR_EMAIL || 'hr@vedhunt.in';
    const fullName = `${firstName} ${lastName}`;

    const emailContent = `
      <h3>New Contact Form Submission</h3>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <br />
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `;

    await sendEmail({
      email: hrEmail,
      subject: `New Contact Inquiry from: ${fullName}`,
      html: emailContent
    });

    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
};
