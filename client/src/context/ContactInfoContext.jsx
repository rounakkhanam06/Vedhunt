import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { CONTACT_INFO as fallbackInfo } from '../constants';

const ContactInfoContext = createContext();

export const ContactInfoProvider = ({ children }) => {
  const [contactInfo, setContactInfo] = useState(fallbackInfo);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const response = await settingsService.getContactInfo();
        if (response.data) {
          // Merge fetched data with fallback data to ensure no missing fields
          setContactInfo({ ...fallbackInfo, ...response.data });
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
        setContactInfo({ ...fallbackInfo, ...response.data });
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
