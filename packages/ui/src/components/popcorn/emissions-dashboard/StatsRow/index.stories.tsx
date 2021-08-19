import {
  CloudIcon,
  CursorClickIcon,
  MailOpenIcon,
  UsersIcon,
} from '@heroicons/react/solid';
import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { EmissionSummaryStats } from '../../../../interfaces/index';
import { StatsRow } from './index';

const dummyItem: EmissionSummaryStats = {
  id: 1,
  name: 'co2Emissions',
  stat: '71kg',
  icon: CloudIcon,
  change: '12.38%',
  changeType: 'increase',
};

export default {
  title: 'Emissions Dashboard / Components / StatsRow',
  component: StatsRow,
  decorators: [
    (Story) => (
      <div className="flex flex-row justify-center">
        <Story></Story>
      </div>
    ),
  ],
} as Meta;

const Template: Story = (args) => <StatsRow {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  stats: [
    {
      id: 1,
      name: 'CO2 Emissions (kg)',
      stat: '71,897',
      icon: UsersIcon,
      change: '122',
      changeType: 'increase',
    },
    {
      id: 2,
      name: 'Transactions',
      stat: '58.16%',
      icon: MailOpenIcon,
      change: '5.4%',
      changeType: 'increase',
    },
    {
      id: 3,
      name: 'Average Gas Price',
      stat: '24.57%',
      icon: CursorClickIcon,
      change: '3.2%',
      changeType: 'decrease',
    },
  ],
};
