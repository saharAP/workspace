// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { AddContractModal } from './index';

export default {
  title: 'Emissions Dashboard / Components / Add Contract Modal',
  component: AddContractModal,
} as Meta;

const Template: Story = (args) => <AddContractModal {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  open: true,
  setOpen: () => {}
};
