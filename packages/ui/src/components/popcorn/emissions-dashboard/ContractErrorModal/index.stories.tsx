import { Meta, Story } from '@storybook/react/types-6-0';
import React from 'react';
import { ContractErrorModal } from './index';

export default {
  title: 'Emissions Dashboard / Components / Contract Error Modal',
  component: ContractErrorModal,
} as Meta;

const Template: Story = (args) => <ContractErrorModal {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  open: true,
  errorMessage: 'The address you entered does not point to a valid Ethereum contract. Please enter a valid address',
  setOpen: () => {},
  addContract: () => {},
};
