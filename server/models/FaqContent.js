const mongoose = require('mongoose');

const faqContentSchema = new mongoose.Schema({
  heroTitle: { 
    type: String, 
    default: "How can we help you?" 
  },
  heroSubtitle: { 
    type: String, 
    default: "Find answers to common questions about our services, processes, and how we can help your business thrive." 
  },
  section1Title: { 
    type: String, 
    default: "Frequently Asked Questions" 
  },
  section1Subtitle: { 
    type: String, 
    default: "Find answers to common questions about our services, processes, and how we can help your business thrive in the digital landscape." 
  },
  section2Title: { 
    type: String, 
    default: "Regular Questions" 
  },
  contactTitle: { 
    type: String, 
    default: "Ask Us Anything" 
  },
  contactSubtitle: { 
    type: String, 
    default: "Have a specific question or a custom project in mind? Drop us a message and our team will get back to you promptly with the information you need." 
  },
  contactAddress: { 
    type: String, 
    default: "123, Tech Hub Road, Mumbai" 
  },
  contactAddressSub: { 
    type: String, 
    default: "Maharashtra, India" 
  },
  contactEmail: { 
    type: String, 
    default: "info@vedhunt.in" 
  },
  contactEmailSub: { 
    type: String, 
    default: "Online Support" 
  },
  contactPhone: { 
    type: String, 
    default: "+91 86524 10289" 
  },
  contactPhoneSub: { 
    type: String, 
    default: "Mon-Fri 9am-6pm" 
  }
}, { timestamps: true });

module.exports = mongoose.model('FaqContent', faqContentSchema);
