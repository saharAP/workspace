import { useRouter } from 'next/router';
import React, { useEffect } from 'react';

import { NavBar } from '@popcorn/ui/components/popcorn/emissions-dashboard/NavBar/index'

const user = {
  name: 'Tom Cook',
  email: 'tom@example.com',
  imageUrl:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
};

export const navigation = [
  { name: 'Dashboard', href: '#', current: true },
];

export const userNavigation = [
  { name: 'Your Profile', href: '#' },
  { name: 'Settings', href: '#' },
  { name: 'Sign out', href: '#' },
];

const IndexPage = () => {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      router.replace(window.location.pathname);
    }
  }, [router.pathname]);

  return (
      <div className="bg-gray-50">
        <NavBar
        title='Smart Contract Emissions Dashboard'
        headerNavigation={navigation}
        userNavigation={userNavigation}
        user={user}
        logo='/icons/popcorn_v1_rainbow_bg.png'
        />
      </div>
    );
};

export default IndexPage;
