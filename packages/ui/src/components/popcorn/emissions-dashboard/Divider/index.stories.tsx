// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { Divider } from './index';

export default {
  title: 'Emissions Dashboard / Components / Divider',
  component: Divider,
  decorators: [
    (Story) => (
      <div className="flex flex-row justify-center">
        <Story></Story>
      </div>
    ),
  ],
} as Meta;

const Template: Story = (args) => <Divider {...args} />;

export const Primary = Template.bind({});
Primary.args = {};
