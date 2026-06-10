import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { CONTACT_INFO as fallbackInfo } from '../constants';

const ContactInfoContext = createContext();
const CACHE_KEY = 'vedhunt_contact_info';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const ContactInfoProvider = ({ children }) => {
  const [contactInfo, setContactInfo] = useState(fallbackInfo);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContactInfo = async () => {
      // Check sessionStorage first — prevents API call on every app mount
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            setContactInfo({ ...fallbackInfo, ...data });
            setLoading(false);
            return;
          }
        }
      } catch (_) { /* ignore parse errors */ }

      try {
        const response = await settingsService.getContactInfo();
        if (response.data) {
          const merged = { ...fallbackInfo, ...response.data };
          setContactInfo(merged);
          // Cache for this session
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: response.data, ts: Date.now() }));
        }
      } catch (error) {
        console.error('Failed to fetch contact info, using fallback.', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContactInfo();
  }, []);

  // Function to refresh the info (e.g. after an admin updates it)
  const refreshContactInfo = async () => {
    try {
      const response = await settingsService.getContactInfo();
      if (response.data) {
        const merged = { ...fallbackInfo, ...response.data };
        setContactInfo(merged);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: response.data, ts: Date.now() }));
      }
    } catch (error) {
      console.error('Failed to refresh contact info', error);
    }
  };

  return (
    <ContactInfoContext.Provider value={{ contactInfo, loading, refreshContactInfo }}>
      {children}
    </ContactInfoContext.Provider>
  );
};

export const useContactInfo = () => useContext(ContactInfoContext);

