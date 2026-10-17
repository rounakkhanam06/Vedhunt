const express = require('express');
const heroController = require('../controllers/heroController');
const navbarController = require('../controllers/navbarController');
const serviceController = require('../controllers/serviceController');
const homeServicesSectionController = require('../controllers/homeServicesSectionController');
const whyChooseUsController = require('../controllers/whyChooseUsController');
const advantageController = require('../controllers/advantageController');
const statsCounterController = require('../controllers/statsCounterController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const { serviceCreateSchema, serviceUpdateSchema } = require('../validators/serviceValidator');
const servicesHeroController = require('../controllers/servicesHeroController');
const presenceController = require('../controllers/presenceController');
const aboutHeroController = require('../controllers/aboutHeroController');
const aboutCompanyController = require('../controllers/aboutCompanyController');
const aboutVideoController = require('../controllers/aboutVideoController');
const aboutWhatWeDoController = require('../controllers/aboutWhatWeDoController');
const aboutVisionMissionController = require('../controllers/aboutVisionMissionController');
const aboutOurEdgeController = require('../controllers/aboutOurEdgeController');
const careerHeroController = require('../controllers/careerHeroController');
const lifeAtVedhuntController = require('../controllers/lifeAtVedhuntController');

const router = express.Router();

// --- Hero Routes ---
router.get('/hero', heroController.getHero);
// Admin only
router.put('/hero', authMiddleware, requirePermission('cms.manage'), heroController.updateHero);

// --- Home Services Section Routes ---
router.get('/home-services-section', homeServicesSectionController.getHomeServicesSection);
router.put('/admin/home-services-section', authMiddleware, requirePermission('cms.manage'), homeServicesSectionController.updateHomeServicesSection);

// --- Why Choose Us Routes ---
router.get('/why-choose-us', whyChooseUsController.getWhyChooseUsPublic);
router.get('/admin/why-choose-us', authMiddleware, requirePermission('cms.manage'), whyChooseUsController.getWhyChooseUsAdmin);
router.put('/admin/why-choose-us/header', authMiddleware, requirePermission('cms.manage'), whyChooseUsController.updateWhyChooseUsHeader);
router.post('/admin/why-choose-us/cards', authMiddleware, requirePermission('cms.manage'), whyChooseUsController.createWhyChooseUsCard);
router.put('/admin/why-choose-us/cards/:id', authMiddleware, requirePermission('cms.manage'), whyChooseUsController.updateWhyChooseUsCard);
router.delete('/admin/why-choose-us/cards/:id', authMiddleware, requirePermission('cms.manage'), whyChooseUsController.deleteWhyChooseUsCard);

// --- Advantage Section Routes ---
router.get('/advantage', advantageController.getAdvantagePublic);
router.get('/admin/advantage', authMiddleware, requirePermission('cms.manage'), advantageController.getAdvantageAdmin);
router.put('/admin/advantage/header', authMiddleware, requirePermission('cms.manage'), advantageController.updateAdvantageHeader);
router.post('/admin/advantage/row', authMiddleware, requirePermission('cms.manage'), advantageController.createAdvantageRow);
router.put('/admin/advantage/row/:id', authMiddleware, requirePermission('cms.manage'), advantageController.updateAdvantageRow);
router.delete('/admin/advantage/row/:id', authMiddleware, requirePermission('cms.manage'), advantageController.deleteAdvantageRow);

// --- Stats Counter Routes ---
router.get('/stats-counter', statsCounterController.getStatsPublic);
router.get('/admin/stats-counter', authMiddleware, requirePermission('cms.manage'), statsCounterController.getStatsAdmin);
router.post('/admin/stats-counter', authMiddleware, requirePermission('cms.manage'), statsCounterController.createStat);
router.put('/admin/stats-counter/:id', authMiddleware, requirePermission('cms.manage'), statsCounterController.updateStat);
router.delete('/admin/stats-counter/:id', authMiddleware, requirePermission('cms.manage'), statsCounterController.deleteStat);

// --- Navbar Routes ---
// Public route (no pagination)
router.get('/navbar', navbarController.getNavbarLinksPublic);

// --- Services Routes ---
// Public route
router.get('/services', serviceController.getServicesPublic);
router.get('/services-hero', servicesHeroController.getServicesHero);

// --- Career Hero Route ---
router.get('/career-hero', careerHeroController.getCareerHero);

// --- Life at Vedhunt Route ---
router.get('/life-at-vedhunt', lifeAtVedhuntController.getPublic);

// --- About Routes ---
router.get('/about-hero', aboutHeroController.getAboutHero);
router.get('/about-company', aboutCompanyController.getAboutCompany);
router.get('/about-video', aboutVideoController.getAboutVideo);
router.get('/about-what-we-do', aboutWhatWeDoController.getAboutWhatWeDo);
router.get('/about-vision-mission', aboutVisionMissionController.getAboutVisionMission);
router.get('/about-our-edge', aboutOurEdgeController.getAboutOurEdge);

// --- Admin routes (Below this uses Auth Middleware) ---
// Each admin route below checks the permission its Admin page requires
router.use('/admin', authMiddleware);
router.get('/admin/navbar', requirePermission('cms.manage'), navbarController.getNavbarLinksAdmin); // paginated with search
router.put('/admin/navbar/:id', requirePermission('cms.manage'), navbarController.renameNavbarLink);
router.delete('/admin/navbar/:id', requirePermission('cms.manage'), navbarController.deleteNavbarLink);

// Admin Service Routes
router.put('/admin/services-hero', requirePermission('services.manage'), servicesHeroController.updateServicesHero);
router.get('/admin/services', requirePermission('services.manage'), serviceController.getServicesAdmin);
router.post('/admin/services', requirePermission('services.manage'), validate(serviceCreateSchema), serviceController.createService);
router.put('/admin/services/:id', requirePermission('services.manage'), validate(serviceUpdateSchema), serviceController.updateService);
router.delete('/admin/services/:id', requirePermission('services.manage'), serviceController.deleteService);

// Admin About Routes
router.put('/admin/about-hero', requirePermission('cms.manage'), aboutHeroController.updateAboutHero);
router.put('/admin/about-company', requirePermission('cms.manage'), aboutCompanyController.updateAboutCompany);
router.put('/admin/about-video', requirePermission('cms.manage'), aboutVideoController.updateAboutVideo);
router.put('/admin/about-what-we-do', requirePermission('cms.manage'), aboutWhatWeDoController.updateAboutWhatWeDo);
router.put('/admin/about-vision-mission', requirePermission('cms.manage'), aboutVisionMissionController.updateAboutVisionMission);
router.put('/admin/about-our-edge', requirePermission('cms.manage'), aboutOurEdgeController.updateAboutOurEdge);

// Admin Career Hero Route
router.put('/admin/career-hero', requirePermission('careers.manage'), careerHeroController.updateCareerHero);

// Admin Life at Vedhunt Routes
router.get('/admin/life-at-vedhunt', requirePermission('careers.manage'), lifeAtVedhuntController.getAdmin);
router.put('/admin/life-at-vedhunt/header', requirePermission('careers.manage'), lifeAtVedhuntController.updateHeader);
router.post('/admin/life-at-vedhunt/cards', requirePermission('careers.manage'), lifeAtVedhuntController.createCard);
router.put('/admin/life-at-vedhunt/cards/:id', requirePermission('careers.manage'), lifeAtVedhuntController.updateCard);
router.delete('/admin/life-at-vedhunt/cards/:id', requirePermission('careers.manage'), lifeAtVedhuntController.deleteCard);

// --- Presence Routes ---
router.get('/presence', presenceController.getPresencePublic);
router.get('/admin/presence', authMiddleware, requirePermission('cms.manage'), presenceController.getPresenceAdmin);
router.put('/admin/presence/header', authMiddleware, requirePermission('cms.manage'), presenceController.updatePresenceHeader);
router.post('/admin/presence/location', authMiddleware, requirePermission('cms.manage'), presenceController.createPresenceLocation);
router.put('/admin/presence/location/:id', authMiddleware, requirePermission('cms.manage'), presenceController.updatePresenceLocation);
router.delete('/admin/presence/location/:id', authMiddleware, requirePermission('cms.manage'), presenceController.deletePresenceLocation);

module.exports = router;
