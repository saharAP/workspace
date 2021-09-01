import React, { useEffect } from 'react';
import Head from 'next/head';
import { Web3ReactProvider } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import { StateProvider } from '../context/store';
import '../styles/globals.css';

function getLibrary(provider: any): Web3Provider {
  const library = new Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
}

export default function DashboardApp(props) {
  const { Component, pageProps } = props;

  useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, []);

  return (
    <React.Fragment>
      <Head>
        <title>Smart Carbon Emissions Dashboard</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500&display=swap"
          rel="stylesheet"
        ></link>
      </Head>
      <Web3ReactProvider getLibrary={getLibrary}>
        <StateProvider>
          <Component {...pageProps} />
        </StateProvider>
      </Web3ReactProvider>
    </React.Fragment>
  );
}
