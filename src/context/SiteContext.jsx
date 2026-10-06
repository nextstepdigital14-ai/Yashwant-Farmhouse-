import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { safeFetch } from '../utils/api';

const SiteContext = createContext();

const getInitialSiteData = () => ({
  settings: null,
  prices: [],
  availability: {},
  gallery: []
});

export const SiteProvider = ({ children }) => {
  const [data, setData] = useState(getInitialSiteData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await safeFetch(`/api/public/data?_t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (res.ok && res.data && res.data.success && res.data.data) {
        const serverData = res.data.data;
        const currentData = {
          settings: serverData.settings || null,
          prices: Array.isArray(serverData.prices) ? serverData.prices : [],
          availability: serverData.availability || {},
          gallery: Array.isArray(serverData.gallery) ? serverData.gallery : []
        };

        setData(currentData);
        setError(null);
      } else {
        console.warn('[SiteData] Backend response issue:', res.error);
        setError(res.error);
      }
    } catch (err) {
      console.warn('[SiteData] Fetch error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submitEnquiry = async (formData) => {
    const res = await safeFetch('/api/public/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!res.ok || !res.data?.success) {
      throw new Error(res.error || res.data?.message || 'Error submitting enquiry');
    }
    return res.data;
  };

  return (
    <SiteContext.Provider value={{
      ...data,
      loading,
      error,
      refreshData: fetchData,
      submitEnquiry
    }}>
      {children}
    </SiteContext.Provider>
  );
};

export const useSiteData = () => useContext(SiteContext);
