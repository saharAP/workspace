import React from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getEmptyChartData } from '../dummyEmissionsData';
import { ChartData } from '../../../../../interfaces/index';

export interface AreaChartProps {
  data: ChartData[];
  height?: number;
  width?: number;
}

const emptyData = getEmptyChartData()

export const AreaBarChart: React.FC<AreaChartProps> = ({
  data,
  height,
  width,
}) => {
  return (
    <div className="w-screen grid justify-items-stretch">
      <ResponsiveContainer
        className="justify-self-start ml-3"
        width="87%"
        height={height}
      >
        {data && data.length ? (
        <ComposedChart data={data}>
          <XAxis dataKey="date" scale="band" hide={true}></XAxis>
          <YAxis
            yAxisId="left"
            orientation="left"
            dataKey="numTransactions"
            tick={false}
            hide={true}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            dataKey="co2Emissions"
            tick={false}
            hide={true}
          />
          <Tooltip />
          <CartesianGrid stroke="#E0E0E0" />
          <Area
            type="monotone"
            dataKey="co2Emissions"
            stroke="#C7D2FE"
            yAxisId="left"
          />
          <Bar
            yAxisId="right"
            dataKey="numTransactions"
            barSize={20}
            fill="#4F46E5"
          />
        </ComposedChart>
        )
        : (
        <ComposedChart data={emptyData}>
          <XAxis dataKey="date" scale="band" hide={true} ></XAxis>
          <CartesianGrid stroke="#E0E0E0" />
          <text x="500" fill="#666" text-anchor="middle" dy="85">No data available to create Chart</text>
        </ComposedChart>
        )
      }
      </ResponsiveContainer>
    </div>
  );
};
