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
import { ChartData } from '../../../../../interfaces/index';
import { getEmptyChartData } from '../dummyEmissionsData';

export interface AreaChartProps {
  data: ChartData[];
  height?: number;
  transactionsDataKey: string;
  dateDataKey: string;
  co2EmissionDataKey: string;
  areaColor?: string;
  barColor?: string;
  gridColor?: string;
}

const emptyData = getEmptyChartData();

export const AreaBarChart: React.FC<AreaChartProps> = ({
  data,
  height,
  transactionsDataKey,
  dateDataKey,
  co2EmissionDataKey,
  areaColor = "#C7D2FE",
  barColor = "#4F46E5",
  gridColor = "#E0E0E0"
}) => {
  return (
    <div className="w-screen grid justify-items-stretch">
      <ResponsiveContainer
        className="justify-self-start ml-3"
        width="87%"
        height={height ? height : 200}
      >
        {data && data.length ? (
          <ComposedChart data={data}>
            <XAxis dataKey={dateDataKey} scale="band" hide={true}></XAxis>
            <YAxis
              yAxisId="left"
              orientation="left"
              dataKey={transactionsDataKey}
              tick={false}
              hide={true}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              dataKey={co2EmissionDataKey}
              tick={false}
              hide={true}
            />
            <Tooltip />
            <CartesianGrid stroke={gridColor} />
            <Area
              type="monotone"
              dataKey={co2EmissionDataKey}
              stroke={areaColor}
              fill={areaColor}
              yAxisId="left"
            />
            <Bar
              yAxisId="right"
              dataKey={transactionsDataKey}
              barSize={20}
              fill={barColor}
            />
          </ComposedChart>
        ) : (
          <ComposedChart data={emptyData}>
            <XAxis dataKey={dateDataKey} scale="band" hide={true}></XAxis>
            <CartesianGrid stroke={gridColor} />
            <text x="50%" fill="#D0D0D0" text-anchor="middle" dy="50%">
              No data available to create chart
            </text>
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
