import { Meta, Story } from '@storybook/react/types-6-0';
import { getDummyEmissionData } from '../dummyEmissionsData';
import { AreaBarChart } from './index';

export default {
  title: 'Emissions Dashboard / Components / Charts / AreaBarChart',
  component: AreaBarChart,
  decorators: [
    (Story) => (
      <div className="flex flex-row justify-center">
        <Story></Story>
      </div>
    ),
  ],
} as Meta;

const Template: Story = (args) => <AreaBarChart {...args} />;

export const ChartWithData = Template.bind({});
ChartWithData.args = {
  data: getDummyEmissionData(),
  height: 200,
  transactionsDataKey: "numTransactions",
  dateDataKey: "date",
  co2EmissionDataKey: "co2Emissions",
};
