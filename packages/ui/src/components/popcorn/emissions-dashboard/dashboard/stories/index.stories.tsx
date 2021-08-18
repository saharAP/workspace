import {
  CloudIcon,
  CursorClickIcon,
  TrendingUpIcon,
} from '@heroicons/react/outline';
import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { AddContractButton } from '../../../AddContractButton';
import Container from '../../../Container';
import { ContractStatsRow } from '../../../ContractStatsRow';
import { DateRangePicker } from '../../../DateRangePicker';
import { Divider } from '../../../Divider';
import { TotalStatsStackedRows } from '../../../TotalStatsStackedRows';

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

const EmissionsDashboardPage = () => {
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
      <DateRangePicker />
      <TotalStatsStackedRows emissionSummaryStats={totalStatsEmissionsData} />
      <Divider />
      <ContractStatsRow
        emissionSummaryStats={contractStats}
        contractName={'Popcorn HYSI Staking Pool'}
      />
      <ContractStatsRow
        emissionSummaryStats={contractStats}
        contractName={'Popcorn HYSI Staking Pool'}
      />
      <ContractStatsRow
        emissionSummaryStats={contractStats}
        contractName={'Popcorn HYSI Staking Pool'}
      />
      <ContractStatsRow
        emissionSummaryStats={contractStats}
        contractName={'Popcorn HYSI Staking Pool'}
      />
      <AddContractButton />
    </div>
  );
};

export default {
  title: 'Emissions Dashboard / Dashboard / StackedLayout',
  component: EmissionsDashboardPage,
  decorators: [
    (Story) => (
      <div className="bg-gray-100">
        <Container title={'Smart Contract Emissions Dashboard'} />
        <Story />
      </div>
    ),
  ],
} as Meta;

const Template: Story = (args) => <EmissionsDashboardPage {...args} />;

export const Primary = Template.bind({});
Primary.args = {};
