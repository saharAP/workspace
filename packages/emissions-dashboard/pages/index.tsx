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
        <NavBar title={'Smart Contract Emissions Dashboard'} />
      </div>
    );
};

export default IndexPage;
