import type { Meta, StoryObj } from '@storybook/react';
import { DatePicker } from './date-picker';
import { useState } from 'react';

const meta: Meta<typeof DatePicker> = {
  title: 'UI/DatePicker',
  component: DatePicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    error: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    min: { control: 'text' },
    max: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default date picker
 */
export const Default: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('');
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Select Date"
          placeholder="Select date..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {date && (
          <p className="mt-2 text-sm text-zinc-400">
            Selected: {date instanceof Date ? date.toISOString() : date}
          </p>
        )}
      </div>
    );
  },
};

/**
 * Date picker with a pre-selected value
 */
export const WithValue: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('2024-12-25');
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Select Date"
          placeholder="Select date..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
    );
  },
};

/**
 * Date picker with minimum date constraint
 */
export const WithMinDate: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('');
    const today = new Date().toISOString().split('T')[0];
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Future Date"
          placeholder="Select a future date..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={today}
          hint="Cannot select past dates"
        />
      </div>
    );
  },
};

/**
 * Date picker with maximum date constraint
 */
export const WithMaxDate: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('');
    const today = new Date().toISOString().split('T')[0];
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Past Date"
          placeholder="Select a past date..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={today}
          hint="Cannot select future dates"
        />
      </div>
    );
  },
};

/**
 * Date picker with both min and max date constraints
 */
export const WithDateRange: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('');
    const today = new Date();
    const minDate = new Date(today);
    minDate.setMonth(minDate.getMonth() - 1);
    const maxDate = new Date(today);
    maxDate.setMonth(maxDate.getMonth() + 1);

    const min = minDate.toISOString().split('T')[0];
    const max = maxDate.toISOString().split('T')[0];

    return (
      <div className="w-[320px]">
        <DatePicker
          label="Date Range"
          placeholder="Select a date within range..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={min}
          max={max}
          hint="Select a date within the last 30 days"
        />
      </div>
    );
  },
};

/**
 * Date picker in error state
 */
export const Error: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('');
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Due Date"
          placeholder="Select due date..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error="Due date is required"
        />
      </div>
    );
  },
};

/**
 * Date picker in success state
 */
export const Success: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('2024-12-25');
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Payment Date"
          placeholder="Select payment date..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
          success
        />
      </div>
    );
  },
};

/**
 * Disabled date picker
 */
export const Disabled: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('2024-12-25');
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Locked Date"
          placeholder="Not editable"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled
        />
      </div>
    );
  },
};

/**
 * Date picker with hint text
 */
export const WithHint: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date>('');
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Maturity Date"
          placeholder="Select maturity date..."
          value={date}
          onChange={(e) => setDate(e.target.value)}
          hint="Invoice maturity date determines the repayment schedule"
        />
      </div>
    );
  },
};

/**
 * Date picker with default value
 */
export const WithDefaultValue: Story = {
  render: () => {
    const [date, setDate] = useState<string | Date | undefined>(undefined);
    return (
      <div className="w-[320px]">
        <DatePicker
          label="Expiry Date"
          placeholder="Select expiry date..."
          value={date}
          defaultValue={new Date('2025-06-15')}
          onChange={(e) => setDate(e.target.value)}
          hint="Defaults to June 15, 2025"
        />
      </div>
    );
  },
};