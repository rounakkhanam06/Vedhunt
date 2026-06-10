/**
 * usePublicContent.js
 * Centralized React Query hooks for all public-facing API endpoints.
 * 
 * WHY: Previously, every component fetched data independently via useEffect + setState.
 * This caused 8-10 redundant API calls on every page mount with zero caching.
 * 
 * NOW: All public data is cached for 5 minutes. Navigating back to a page is instant.
 * Multiple components subscribing to the same queryKey share one cached response.
 */

import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { contentService } from '../services/contentService';

const STALE_TIME = 2 * 60 * 1000;  // 2 minutes
const GC_TIME   = 10 * 60 * 1000;  // 10 minutes

// ── Services Preview (Home page) ─────────────────────────────────────────────
export const useHomeServices = () =>
  useQuery({
    queryKey: ['home-services'],
    queryFn: () => contentService.getServicesPublic('home'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    select: (data) => (data?.data || []).slice(0, 6),
  });

export const useHomeServicesSection = () =>
  useQuery({
    queryKey: ['home-services-section'],
    queryFn: () => contentService.getHomeServicesSection(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    select: (data) => data?.data || null,
  });

// ── Why Choose Us ─────────────────────────────────────────────────────────────
export const useWhyChooseUs = () =>
  useQuery({
    queryKey: ['why-choose-us'],
    queryFn: () => contentService.getWhyChooseUsPublic(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    select: (data) => data?.data || null,
  });

// ── Stats Counter ─────────────────────────────────────────────────────────────
export const useStatsCounter = () =>
  useQuery({
    queryKey: ['stats-counter'],
    queryFn: () => contentService.getStatsCounterPublic(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    select: (data) => data?.data || [],
  });

// ── Testimonials ──────────────────────────────────────────────────────────────
export const useTestimonials = () =>
  useQuery({
    queryKey: ['testimonials-approved'],
    queryFn: async () => {
      const res = await api.get('/testimonials/approved');
      return res.data?.data || [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

// ── Featured Portfolio ─────────────────────────────────────────────────────────
export const useFeaturedPortfolio = () =>
  useQuery({
    queryKey: ['portfolio-featured'],
    queryFn: async () => {
      const res = await api.get('/portfolio?featured=true&limit=4');
      return res.data?.data || [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

// ── Home Pricing Preview ───────────────────────────────────────────────────────
export const useHomePricing = () =>
  useQuery({
    queryKey: ['home-pricing'],
    queryFn: async () => {
      const res = await api.get('/home-pricing?showOnHome=true');
      return res.data?.success ? res.data.data : [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

// ── Presence Map ───────────────────────────────────────────────────────────────
export const usePresence = () =>
  useQuery({
    queryKey: ['presence'],
    queryFn: () => contentService.getPresencePublic(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

// ── About Page Data ────────────────────────────────────────────────────────────
export const useAboutData = () =>
  useQuery({
    queryKey: ['about-all'],
    queryFn: async () => {
      const [heroRes, companyRes, videoRes, whatWeDoRes, visionMissionRes, ourEdgeRes] = await Promise.all([
        contentService.getAboutHero(),
        contentService.getAboutCompany(),
        contentService.getAboutVideo(),
        contentService.getAboutWhatWeDo(),
        contentService.getAboutVisionMission(),
        contentService.getAboutOurEdge(),
      ]);
      return {
        heroData: heroRes,
        companyData: companyRes,
        videoData: videoRes,
        whatWeDoData: whatWeDoRes,
        visionMissionData: visionMissionRes,
        ourEdgeData: ourEdgeRes,
      };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
