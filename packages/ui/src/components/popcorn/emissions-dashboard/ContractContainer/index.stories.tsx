import { CloudIcon, TrendingUpIcon } from '@heroicons/react/outline';
import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { EmissionSummaryStats } from '../../../../interfaces/index';
import { ContractContainer } from './index';

const emissionSummaryStats: EmissionSummaryStats[] = [
  {
    id: 1,
    name: 'CO2 Emissions (kg)',
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

export default {
  title: 'Emissions Dashboard / Components / ContractContainer',
  component: ContractContainer,
  decorators: [
    (Story) => (
      <div className="flex flex-row justify-center ">
        <Story></Story>
      </div>
    ),
  ],
} as Meta;

const Template: Story = (args) => <ContractContainer {...args} />;
export const Primary = Template.bind({});
Primary.args = {
  emissionSummaryStats: emissionSummaryStats,
  contractName: 'Popcorn HYSI Staking Pool',
};
