const Faq = require('../models/Faq');
const FaqContent = require('../models/FaqContent');
const { SuccessResponse } = require('../utils/apiResponse');

// Get FAQ Content
exports.getFaqContent = async (req, res, next) => {
    try {
        let content = await FaqContent.findOne();
        if (!content) {
            content = await FaqContent.create({});
        }
        res.status(200).json(new SuccessResponse(content, 'FAQ content fetched successfully'));
    } catch (error) {
        next(error);
    }
};

// Update FAQ Content
exports.updateFaqContent = async (req, res, next) => {
    try {
        let content = await FaqContent.findOne();
        if (!content) {
            content = await FaqContent.create(req.body);
        } else {
            Object.assign(content, req.body);
            await content.save();
        }
        res.status(200).json(new SuccessResponse(content, 'FAQ content updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Get all FAQs
exports.getFaqs = async (req, res, next) => {
    try {
        const { category } = req.query;
        let query = {};
        if (category) {
            query.category = category;
        }
        const faqs = await Faq.find(query).sort({ order: 1, createdAt: -1 });
        res.status(200).json(new SuccessResponse(faqs, 'FAQs fetched successfully'));
    } catch (error) {
        next(error);
    }
};

// Create a new FAQ
exports.createFaq = async (req, res, next) => {
    try {
        const faq = await Faq.create(req.body);
        res.status(201).json(new SuccessResponse(faq, 'FAQ created successfully'));
    } catch (error) {
        next(error);
    }
};

// Update an FAQ
exports.updateFaq = async (req, res, next) => {
    try {
        const faq = await Faq.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!faq) {
            const error = new Error('FAQ not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json(new SuccessResponse(faq, 'FAQ updated successfully'));
    } catch (error) {
        next(error);
    }
};

// Delete an FAQ
exports.deleteFaq = async (req, res, next) => {
    try {
        const faq = await Faq.findByIdAndDelete(req.params.id);
        if (!faq) {
            const error = new Error('FAQ not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json(new SuccessResponse(null, 'FAQ deleted successfully'));
    } catch (error) {
        next(error);
    }
};

// Seed initial FAQ data
exports.seedFaqData = async () => {
    try {
        // Clear existing FAQs to fix duplicate issues
        await Faq.deleteMany({});
        
        const faqsSection1 = [
            {
                question: "What exactly does Vedhunt Infotech do?",
                answer: "Vedhunt Infotech is a premier digital agency specializing in Web Development, Search Engine Optimization (SEO), UI/UX Design, and custom software solutions tailored to help your business thrive in the digital landscape.",
                category: 'frequent',
                order: 1
            },
            {
                question: "How much does a custom website or SEO consultation cost?",
                answer: "Our pricing depends entirely on the scope and complexity of your project. We offer customized packages designed to fit your specific business needs and budget. Contact us for a detailed, no-obligation quote.",
                category: 'frequent',
                order: 2
            },
            {
                question: "What payment methods do you accept?",
                answer: "We accept all major credit cards, direct bank transfers, and standard online payment gateways. For larger, ongoing projects, we also offer flexible milestone-based payment plans.",
                category: 'frequent',
                order: 3
            }
        ];

        const faqsSection2 = [
            {
                question: "How long does it typically take to develop a website?",
                answer: "A standard corporate website usually takes 4 to 8 weeks from initial design to final launch. More complex platforms, like e-commerce sites or custom web applications, may take 3 to 5 months depending on the required features.",
                category: 'regular',
                order: 1
            },
            {
                question: "Do you offer ongoing support after project completion?",
                answer: "Yes, absolutely! We provide ongoing maintenance and dedicated support packages to ensure your digital assets remain secure, up-to-date, and continue to perform optimally.",
                category: 'regular',
                order: 2
            },
            {
                question: "Can you help redesign an existing, outdated website?",
                answer: "Yes. We specialize in revamping outdated websites with modern design principles, improved UX/UI, enhanced mobile responsiveness, and better core web vitals for SEO.",
                category: 'regular',
                order: 3
            },
            {
                question: "What industries do you specialize in?",
                answer: "We have extensive experience working across various industries including healthcare, e-commerce, real estate, education, finance, and enterprise SaaS solutions.",
                category: 'regular',
                order: 4
            },
            {
                question: "Will my website be mobile-friendly and optimized for SEO?",
                answer: "Every website we build is fully responsive, meaning it will look and function perfectly on all devices (mobile, tablet, desktop). We also build with SEO best practices in mind to give you a head start on search rankings.",
                category: 'regular',
                order: 5
            }
        ];

        await Faq.insertMany([...faqsSection1, ...faqsSection2]);
        console.log('FAQ data cleared and seeded successfully');

        const contentCount = await FaqContent.countDocuments();
        if (contentCount === 0) {
            await FaqContent.create({
                heroTitle: "How can we help you?",
                heroSubtitle: "Find answers to common questions about our services, processes, and how we can help your business thrive.",
                section1Title: "Frequently Asked Questions",
                section1Subtitle: "Find answers to common questions about our services, processes, and how we can help your business thrive in the digital landscape.",
                section2Title: "Regular Questions",
                contactTitle: "Ask Us Anything",
                contactSubtitle: "Have a specific question or a custom project in mind? Drop us a message and our team will get back to you promptly with the information you need.",
                contactAddress: "123, Tech Hub Road, Mumbai",
                contactAddressSub: "Maharashtra, India",
                contactEmail: "info@vedhunt.in",
                contactEmailSub: "Online Support",
                contactPhone: "+91 86524 10289",
                contactPhoneSub: "Mon-Fri 9am-6pm"
            });
            console.log('FAQ Content seeded successfully');
        }
    } catch (error) {
        console.error('Error seeding FAQ data:', error);
    }
};
