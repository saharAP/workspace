import { useRouter } from 'next/router';
import React, { useEffect } from 'react';

import { NavBar } from '@popcorn/ui/components/popcorn/emissions-dashboard/NavBar/index'

const IndexPage = () => {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      router.replace(window.location.pathname);
    }
  }, [router.pathname]);

  return (
      <div className="bg-gray-50">
        <div className="py-10">
          <header>
            <div className="max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold leading-tight text-gray-900">
                Smart Contract Carbon Emissions Dashboard
              </h1>
            </div>
          </header>
        </div>
        <NavBar />
        {/* <DateRangePicker /> */}
      </div>
    );
};

export default IndexPage;
