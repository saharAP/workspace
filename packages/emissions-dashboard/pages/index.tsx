import { NavBar } from '@popcorn/ui/components/popcorn/emissions-dashboard/NavBar/index';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const user = {
  name: 'Tom Cook',
  email: 'tom@example.com',
  imageUrl:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
};

export const navigation = [{ name: 'Dashboard', href: '#', current: true }];

export const userNavigation = [
  { name: 'Your Profile', href: '#' },
  { name: 'Settings', href: '#' },
  { name: 'Sign out', href: '#' },
];

const IndexPage = () => {
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      router.replace(window.location.pathname);
    }
  }, [router.pathname]);

  const addContract = (contractAddress: string): void => {
    if(contractAddress){
      if (localStorage.getItem('contracts')) {
        const existingContracts = JSON.parse(localStorage.getItem('contracts'));
        existingContracts.push(contractAddress);
        localStorage.setItem('contracts', JSON.stringify(existingContracts));
      } else {
        localStorage.setItem('contracts', JSON.stringify([contractAddress]));
      }
      setOpen(false);
    } else {
      setErrorMessage("No Contract Address was provided");
    }
  };

  const openAddContractModal = ():void => {
    setOpen(true);
    setErrorMessage("");
  };

  return (
    <>
      <NavBar
        title="Smart Contract Emissions Dashboard"
        headerNavigation={navigation}
        userNavigation={userNavigation}
        user={user}
        logo="/images/popcorn-logo.png"
        contractProps={{ addContract, open, setOpen }}
        contractErrorProps={{ openAddContractModal, errorMessage, setErrorMessage }}
      />
    </>
  );
};

export default IndexPage;
