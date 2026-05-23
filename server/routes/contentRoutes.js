const express = require('express');
const heroController = require('../controllers/heroController');
const navbarController = require('../controllers/navbarController');
const serviceController = require('../controllers/serviceController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validate');
const { serviceCreateSchema, serviceUpdateSchema } = require('../validators/serviceValidator');

const router = express.Router();

// --- Hero Routes ---
router.get('/hero', heroController.getHero);
// Admin only
router.put('/hero', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), heroController.updateHero);

// --- Navbar Routes ---
// Public route (no pagination)
router.get('/navbar', navbarController.getNavbarLinksPublic);

// --- Services Routes ---
// Public route
router.get('/services', serviceController.getServicesPublic);

// --- Admin routes (Below this uses Auth Middleware) ---
router.use('/admin', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'));
router.get('/admin/navbar', navbarController.getNavbarLinksAdmin); // paginated with search
router.put('/admin/navbar/:id', navbarController.renameNavbarLink);
router.delete('/admin/navbar/:id', navbarController.deleteNavbarLink);

// Admin Service Routes
router.get('/admin/services', serviceController.getServicesAdmin);
router.post('/admin/services', validate(serviceCreateSchema), serviceController.createService);
router.put('/admin/services/:id', validate(serviceUpdateSchema), serviceController.updateService);
router.delete('/admin/services/:id', serviceController.deleteService);

module.exports = router;
