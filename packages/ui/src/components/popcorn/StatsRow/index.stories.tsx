// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { CloudIcon } from '@heroicons/react/solid';
import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { EmissionSummaryStats } from '../TotalStats';
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
  title: 'Popcorn/StatsRow',
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
  item: dummyItem,
};
