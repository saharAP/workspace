import { useRouter } from 'next/router';
import React, { useEffect } from 'react';

const EmissionDashboard = () => {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      router.replace(window.location.pathname);
    }
  }, [router.pathname]);

  return (
    <div
      className="w-full h-screen flex flex-col justify-center font-landing"
      style={{ backgroundColor: '#F8F8FB' }}
    >
      Emissions Dashboard
    </div>
  );
};

export default EmissionDashboard;

