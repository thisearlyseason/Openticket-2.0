import React from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Card } from './UI';

// Color palette
const COLORS = {
    primary: '#ec4899',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    zinc: '#71717a'
};

const CHART_COLORS = [COLORS.primary, COLORS.blue, COLORS.success, COLORS.warning, COLORS.purple];

/**
 * Hourly Scans Bar Chart
 */
export const HourlyScansChart: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <Card className="p-6 bg-zinc-900 border-zinc-800 text-center">
                <p className="text-zinc-500">No hourly data available</p>
            </Card>
        );
    }

    return (
        <Card className="p-6 bg-zinc-900 border-zinc-800">
            <h3 className="font-bold text-lg text-white mb-4">Scans by Hour</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                        dataKey="hour" 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa' }}
                    />
                    <YAxis 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa' }}
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend wrapperStyle={{ color: '#a1a1aa' }} />
                    <Bar dataKey="scan_count" fill={COLORS.primary} name="Total Scans" />
                    <Bar dataKey="successful_count" fill={COLORS.success} name="Successful" />
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
};

/**
 * Daily Trends Line Chart
 */
export const DailyTrendsChart: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <Card className="p-6 bg-zinc-900 border-zinc-800 text-center">
                <p className="text-zinc-500">No daily data available</p>
            </Card>
        );
    }

    // Format data for display
    const formattedData = data.map(d => ({
        ...d,
        date: new Date(d.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));

    return (
        <Card className="p-6 bg-zinc-900 border-zinc-800">
            <h3 className="font-bold text-lg text-white mb-4">Daily Scan Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={formattedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                        dataKey="date" 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa' }}
                    />
                    <YAxis 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa' }}
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend wrapperStyle={{ color: '#a1a1aa' }} />
                    <Line 
                        type="monotone" 
                        dataKey="total_scans" 
                        stroke={COLORS.primary} 
                        strokeWidth={2}
                        name="Total Scans"
                        dot={{ fill: COLORS.primary }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="successful_scans" 
                        stroke={COLORS.success} 
                        strokeWidth={2}
                        name="Successful"
                        dot={{ fill: COLORS.success }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </Card>
    );
};

/**
 * Scan Methods Pie Chart
 */
export const ScanMethodsChart: React.FC<{ data: { camera: number; upload: number; manual: number } }> = ({ data }) => {
    const chartData = [
        { name: 'Camera', value: data.camera },
        { name: 'Upload', value: data.upload },
        { name: 'Manual', value: data.manual }
    ].filter(item => item.value > 0);

    if (chartData.length === 0) {
        return (
            <Card className="p-6 bg-zinc-900 border-zinc-800 text-center">
                <p className="text-zinc-500">No scan method data available</p>
            </Card>
        );
    }

    return (
        <Card className="p-6 bg-zinc-900 border-zinc-800">
            <h3 className="font-bold text-lg text-white mb-4">Scan Methods Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend wrapperStyle={{ color: '#a1a1aa' }} />
                </PieChart>
            </ResponsiveContainer>
        </Card>
    );
};

/**
 * Success Rate Trend Line Chart
 */
export const SuccessRateTrendChart: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <Card className="p-6 bg-zinc-900 border-zinc-800 text-center">
                <p className="text-zinc-500">No trend data available</p>
            </Card>
        );
    }

    // Calculate success rate for each data point
    const formattedData = data.map(d => ({
        ...d,
        successRate: d.total_scans > 0 
            ? ((d.successful_scans / d.total_scans) * 100).toFixed(1)
            : 0,
        date: new Date(d.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));

    return (
        <Card className="p-6 bg-zinc-900 border-zinc-800">
            <h3 className="font-bold text-lg text-white mb-4">Success Rate Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={formattedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                        dataKey="date" 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa' }}
                    />
                    <YAxis 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa' }}
                        domain={[0, 100]}
                        label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        formatter={(value: any) => `${value}%`}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="successRate" 
                        stroke={COLORS.success} 
                        strokeWidth={3}
                        name="Success Rate"
                        dot={{ fill: COLORS.success, r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </Card>
    );
};

/**
 * Performance Metrics Bar Chart
 */
export const PerformanceMetricsChart: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <Card className="p-6 bg-zinc-900 border-zinc-800 text-center">
                <p className="text-zinc-500">No performance data available</p>
            </Card>
        );
    }

    // Take top 10 events by total scans
    const topEvents = data
        .sort((a, b) => b.totalScans - a.totalScans)
        .slice(0, 10)
        .map(e => ({
            name: e.eventTitle.substring(0, 20) + (e.eventTitle.length > 20 ? '...' : ''),
            avgTime: e.avgDuration,
            scans: e.totalScans
        }));

    return (
        <Card className="p-6 bg-zinc-900 border-zinc-800">
            <h3 className="font-bold text-lg text-white mb-4">Top Events by Volume</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topEvents} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" stroke="#71717a" tick={{ fill: '#a1a1aa' }} />
                    <YAxis 
                        type="category" 
                        dataKey="name" 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa' }}
                        width={150}
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend wrapperStyle={{ color: '#a1a1aa' }} />
                    <Bar dataKey="scans" fill={COLORS.primary} name="Total Scans" />
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
};

export default {
    HourlyScansChart,
    DailyTrendsChart,
    ScanMethodsChart,
    SuccessRateTrendChart,
    PerformanceMetricsChart
};
