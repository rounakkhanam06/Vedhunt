const Service = require('../models/Service');

let publicServicesCache = null;

class ServiceManager {
  // Clear the public service cache
  clearCache() {
    publicServicesCache = null;
  }

  // Public API: Highly optimized, lean(), minimal fields with In-Memory Caching
  async getPublicServices(location = '') {
    const cacheKey = location || 'all';
    if (publicServicesCache && publicServicesCache[cacheKey]) {
      return publicServicesCache[cacheKey];
    }

    const query = { isActive: true };
    if (location === 'home') {
      query.showOnHome = true;
    } else if (location === 'services') {
      query.showOnServicesPage = true;
    }

    const services = await Service.find(query)
      .sort({ order: 1 })
      .select('id_string slug title subtitle shortDescription description subServices iconName features cta imageUrl showOnHome showOnServicesPage _id')
      .lean();

    if (!publicServicesCache) {
      publicServicesCache = {};
    }
    publicServicesCache[cacheKey] = services;
    return services;
  }

  // Admin API: Pagination, Search, sorting
  async getAdminServices(page = 1, limit = 10, search = '') {
    const query = {};
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [services, total] = await Promise.all([
      Service.find(query)
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit)
        .select('-__v -isDeleted')
        .lean(),
      Service.countDocuments(query)
    ]);

    return { services, total };
  }

  async getServiceById(id) {
    const service = await Service.findById(id).lean();
    if (!service) throw new Error('Service not found');
    return service;
  }

  async createService(data, userId) {
    const newOrder = await Service.countDocuments();
    
    const service = new Service({
      ...data,
      order: data.order || newOrder + 1,
      updatedBy: userId
    });
    
    await service.save();
    this.clearCache(); // Evict public services cache
    return service;
  }

  async updateService(id, data, userId) {
    const service = await Service.findById(id);
    if (!service) throw new Error('Service not found');

    Object.assign(service, data);
    service.updatedBy = userId;
    
    await service.save();
    this.clearCache(); // Evict public services cache
    return service;
  }

  // Soft delete handled by pre-find middleware in model, but here we just update the flag
  async softDeleteService(id, userId) {
    const service = await Service.findById(id);
    if (!service) throw new Error('Service not found');

    service.isDeleted = true;
    service.isActive = false;
    service.updatedBy = userId;
    
    await service.save();
    this.clearCache(); // Evict public services cache
    return true;
  }
}

module.exports = new ServiceManager();
