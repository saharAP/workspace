import {
  CloudIcon,
  CursorClickIcon,
  TrendingUpIcon,
} from '@heroicons/react/outline';
import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { ContractContainer } from '../../ContractContainer';
import { DateRangePicker } from '../../DateRangePicker';
import { Divider } from '../../Divider';
import { NavBar } from '../../NavBar';
import { TotalsContainer } from '../../TotalsContainer';

const totalStatsEmissionsData = [
  {
    id: 1,
    name: 'co2Emissions',
    stat: '71kg',
    icon: CloudIcon,
    change: '12.38%',
    changeType: 'increase',
  },
  {
    id: 2,
    name: 'Transactions',
    stat: '23',
    icon: TrendingUpIcon,
    change: '5.4%',
    changeType: 'increase',
  },
  {
    id: 3,
    name: 'Average Gas Price',
    stat: '45',
    icon: CursorClickIcon,
    change: '3.2%',
    changeType: 'decrease',
  },
];

const contractStats = [
  {
    id: 1,
    name: 'co2Emissions',
    stat: '71kg',
    icon: CloudIcon,
    change: '12.38%',
    changeType: 'increase',
  },
  {
    id: 2,
    name: 'Transactions',
    stat: '23',
    icon: TrendingUpIcon,
    change: '5.4%',
    changeType: 'increase',
  },
];

const user = {
  name: 'Tom Cook',
  email: 'tom@example.com',
  imageUrl:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
};

const navigation = [
    { name: 'Dashboard', href: '#', current: true },
    { name: 'Team', href: '#', current: false },
    { name: 'Projects', href: '#', current: false },
    { name: 'Calendar', href: '#', current: false },
];

const userNavigation = [
  { name: 'Your Profile', href: '#' },
  { name: 'Settings', href: '#' },
  { name: 'Sign out', href: '#' },
];

const EmissionsDashboardPage = () => {
  return (
    <div className="bg-gray-50">
      <DateRangePicker />
      <TotalsContainer emissionSummaryStats={totalStatsEmissionsData} />
      <Divider />
      {new Array(4).fill(undefined).map((x) => {
        return (
          <ContractContainer
            emissionSummaryStats={contractStats}
            contractName={'Popcorn HYSI Staking Pool'}
          />
        );
      })}
    </div>
  );
};

export default {
  title: 'Emissions Dashboard / Dashboard / StackedLayout',
  component: EmissionsDashboardPage,
  decorators: [
    (Story) => (
      <>
        <NavBar
        title='Smart Contract Emissions Dashboard'
        headerNavigation={navigation}
        userNavigation={userNavigation}
        user={user}
        logo='https://tailwindui.com/img/logos/workflow-mark-indigo-600.svg'
        contractProps={
          {
            open:false,
            setOpen: () => {},
            addContract: () => {},
          }
        }
        contractErrorProps={
          {
            errorMessage: 'Fatal error, run your life',
            setErrorMessage: () => {},
            openAddContractModal: () => {},
          }
        }
        />
        <Story />
      </>
    ),
  ],
} as Meta;

const Template: Story = (args) => <EmissionsDashboardPage {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  contractProps:{
    open:false,
    setOpen: () => {},
    addContract: () => {},
  },
  contractErrorProps: {
    errorMessage: 'Fatal error, run your life',
    setErrorMessage: () => {},
    openAddContractModal: () => {},
  }
};
