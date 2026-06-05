const express = require('express');
const heroController = require('../controllers/heroController');
const navbarController = require('../controllers/navbarController');
const serviceController = require('../controllers/serviceController');
const homeServicesSectionController = require('../controllers/homeServicesSectionController');
const whyChooseUsController = require('../controllers/whyChooseUsController');
const advantageController = require('../controllers/advantageController');
const statsCounterController = require('../controllers/statsCounterController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
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
router.put('/hero', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), heroController.updateHero);

// --- Home Services Section Routes ---
router.get('/home-services-section', homeServicesSectionController.getHomeServicesSection);
router.put('/admin/home-services-section', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), homeServicesSectionController.updateHomeServicesSection);

// --- Why Choose Us Routes ---
router.get('/why-choose-us', whyChooseUsController.getWhyChooseUsPublic);
router.get('/admin/why-choose-us', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), whyChooseUsController.getWhyChooseUsAdmin);
router.put('/admin/why-choose-us/header', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), whyChooseUsController.updateWhyChooseUsHeader);
router.post('/admin/why-choose-us/cards', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), whyChooseUsController.createWhyChooseUsCard);
router.put('/admin/why-choose-us/cards/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), whyChooseUsController.updateWhyChooseUsCard);
router.delete('/admin/why-choose-us/cards/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), whyChooseUsController.deleteWhyChooseUsCard);

// --- Advantage Section Routes ---
router.get('/advantage', advantageController.getAdvantagePublic);
router.get('/admin/advantage', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), advantageController.getAdvantageAdmin);
router.put('/admin/advantage/header', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), advantageController.updateAdvantageHeader);
router.post('/admin/advantage/row', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), advantageController.createAdvantageRow);
router.put('/admin/advantage/row/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), advantageController.updateAdvantageRow);
router.delete('/admin/advantage/row/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), advantageController.deleteAdvantageRow);

// --- Stats Counter Routes ---
router.get('/stats-counter', statsCounterController.getStatsPublic);
router.get('/admin/stats-counter', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), statsCounterController.getStatsAdmin);
router.post('/admin/stats-counter', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), statsCounterController.createStat);
router.put('/admin/stats-counter/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), statsCounterController.updateStat);
router.delete('/admin/stats-counter/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), statsCounterController.deleteStat);

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
router.use('/admin', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'));
router.get('/admin/navbar', navbarController.getNavbarLinksAdmin); // paginated with search
router.put('/admin/navbar/:id', navbarController.renameNavbarLink);
router.delete('/admin/navbar/:id', navbarController.deleteNavbarLink);

// Admin Service Routes
router.put('/admin/services-hero', servicesHeroController.updateServicesHero);
router.get('/admin/services', serviceController.getServicesAdmin);
router.post('/admin/services', validate(serviceCreateSchema), serviceController.createService);
router.put('/admin/services/:id', validate(serviceUpdateSchema), serviceController.updateService);
router.delete('/admin/services/:id', serviceController.deleteService);

// Admin About Routes
router.put('/admin/about-hero', aboutHeroController.updateAboutHero);
router.put('/admin/about-company', aboutCompanyController.updateAboutCompany);
router.put('/admin/about-video', aboutVideoController.updateAboutVideo);
router.put('/admin/about-what-we-do', aboutWhatWeDoController.updateAboutWhatWeDo);
router.put('/admin/about-vision-mission', aboutVisionMissionController.updateAboutVisionMission);
router.put('/admin/about-our-edge', aboutOurEdgeController.updateAboutOurEdge);

// Admin Career Hero Route
router.put('/admin/career-hero', careerHeroController.updateCareerHero);

// Admin Life at Vedhunt Routes
router.get('/admin/life-at-vedhunt', lifeAtVedhuntController.getAdmin);
router.put('/admin/life-at-vedhunt/header', lifeAtVedhuntController.updateHeader);
router.post('/admin/life-at-vedhunt/cards', lifeAtVedhuntController.createCard);
router.put('/admin/life-at-vedhunt/cards/:id', lifeAtVedhuntController.updateCard);
router.delete('/admin/life-at-vedhunt/cards/:id', lifeAtVedhuntController.deleteCard);

// --- Presence Routes ---
router.get('/presence', presenceController.getPresencePublic);
router.get('/admin/presence', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), presenceController.getPresenceAdmin);
router.put('/admin/presence/header', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), presenceController.updatePresenceHeader);
router.post('/admin/presence/location', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), presenceController.createPresenceLocation);
router.put('/admin/presence/location/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), presenceController.updatePresenceLocation);
router.delete('/admin/presence/location/:id', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), presenceController.deletePresenceLocation);

module.exports = router;
