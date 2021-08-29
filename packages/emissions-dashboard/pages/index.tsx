import { NavBar } from '@popcorn/ui/components/popcorn/emissions-dashboard/NavBar/index';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import web3 from 'web3';
import { useWeb3React } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import { connectors } from '../context/Web3/connectors';

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
  const context = useWeb3React<Web3Provider>();
  const {
    library,
    activate,
    active,
  } = context;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      router.replace(window.location.pathname);
    }
  }, [router.pathname]);

  useEffect(() => {
    if (!active) {
      activate(connectors.Network);
    }
  }, [active]);

  const addContract = async(contractAddress: string): Promise<void> => {
    const enterMessage: string =  "Please enter a valid address";
    let message: string;
    if(contractAddress){
      if(web3.utils.isAddress(contractAddress)){
        const code = await library.getCode(contractAddress);
        const isConnected = !(code === "0x0" || code === "0x")
        if(isConnected){
          if (localStorage.getItem('contracts')) {
            const existingContracts = JSON.parse(localStorage.getItem('contracts'));
            if (!existingContracts.includes(contractAddress)) {
              existingContracts.push(contractAddress);
              localStorage.setItem('contracts', JSON.stringify(existingContracts));
            }
          } else {
            localStorage.setItem('contracts', JSON.stringify([contractAddress]));
          }
        } else {
          message = `The address you entered does not point to a valid Ethereum contract. ${enterMessage}`
        }
      } else {
        message = `The address you entered is not a valid Ethereum contract. ${enterMessage}`
      }
    } else {
      message = `No Contract Address was provided. ${enterMessage}`;
    }
    setErrorMessage(message);
    setOpen(false);
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
