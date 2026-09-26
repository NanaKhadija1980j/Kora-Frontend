import type { Meta, StoryObj } from '@storybook/react';
import { Drawer, DrawerContent, DrawerSection } from './drawer';
import { Button } from './button';
import { useState } from 'react';

const meta: Meta<typeof Drawer> = {
  title: 'UI/Drawer',
  component: Drawer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean' },
    title: { control: 'text' },
    description: { control: 'text' },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default drawer with title and description
 */
export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Drawer</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Drawer Title"
          description="This is a description for the drawer."
          size="md"
        >
          <DrawerContent>
            <DrawerSection title="Position Details" description="Key information about your position">
              <p className="text-zinc-300">
                This section contains the position details. You can
                customize the content using DrawerSection.
              </p>
            </DrawerSection>
            <DrawerSection title="Actions">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setOpen(false)}>Save</Button>
              </div>
            </DrawerSection>
          </DrawerContent>
        </Drawer>
      </div>
    );
  },
};

/**
 * Small drawer variant
 */
export const Small: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Small Drawer</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Confirm"
          description="Are you sure?"
          size="sm"
        >
          <DrawerContent>
            <p className="text-zinc-300">
              This is a small drawer, ideal for confirmations or quick
              actions.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  },
};

/**
 * Large drawer variant
 */
export const Large: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Large Drawer</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Full Details"
          description="Comprehensive view of the data"
          size="lg"
        >
          <DrawerContent>
            <DrawerSection title="Overview">
              <p className="text-zinc-300">
                The large drawer provides more horizontal space for
                detailed content, tables, or multi-column layouts.
              </p>
            </DrawerSection>
            <DrawerSection title="Data Table">
              <table className="w-full text-sm text-left text-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-100">Item A</td>
                    <td className="px-3 py-2">$1,234</td>
                    <td className="px-3 py-2 text-emerald-400">Active</td>
                  </tr>
                  <tr className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-100">Item B</td>
                    <td className="px-3 py-2">$5,678</td>
                    <td className="px-3 py-2 text-zinc-400">Pending</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-zinc-100">Item C</td>
                    <td className="px-3 py-2">$9,012</td>
                    <td className="px-3 py-2 text-red-400">Error</td>
                  </tr>
                </tbody>
              </table>
            </DrawerSection>
          </DrawerContent>
        </Drawer>
      </div>
    );
  },
};

/**
 * Drawer with long scrollable content
 */
export const LongContent: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Long Drawer</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Terms & Conditions"
          description="Please read carefully before proceeding"
          size="md"
        >
          <DrawerContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((section) => (
                <DrawerSection key={section} title={`Section ${section}`}>
                  <p className="text-zinc-300">
                    Lorem ipsum dolor sit amet, consectetur adipiscing
                    elit. Sed do eiusmod tempor incididunt ut labore et
                    dolore magna aliqua. Ut enim ad minim veniam, quis
                    nostrud exercitation ullamco laboris nisi ut aliquip
                    ex ea commodo consequat.
                  </p>
                </DrawerSection>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Decline
                </Button>
                <Button onClick={() => setOpen(false)}>Accept</Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  },
};

/**
 * Drawer without a title or description
 */
export const Minimal: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Minimal Drawer</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          size="md"
        >
          <DrawerContent>
            <p className="text-zinc-300">
              This drawer has no header title or description. Just
              content.
            </p>
            <Button onClick={() => setOpen(false)} className="mt-4">
              Close
            </Button>
          </DrawerContent>
        </Drawer>
      </div>
    );
  },
};

/**
 * Drawer using DrawerSection and DrawerContent compound components
 */
export const WithSections: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Structured Drawer</Button>
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Position Details"
          description="Review your current position"
          size="md"
        >
          <DrawerContent>
            <DrawerSection title="Basic Information" description="Core details">
              <p className="text-zinc-300">
                Invoice ID: INV-2024-001
              </p>
              <p className="text-zinc-300">
                Issuer: Acme Corp Ltd
              </p>
              <p className="text-zinc-300">
                Amount: $50,000 USDC
              </p>
            </DrawerSection>
            <DrawerSection title="Funding Details" description="Funding progress">
              <p className="text-zinc-300">
                Target: $47,000 USDC
              </p>
              <p className="text-zinc-300">
                Raised: $47,000 USDC
              </p>
              <p className="text-zinc-300">
                Progress: 100%
              </p>
            </DrawerSection>
            <DrawerSection title="Risk Assessment" description="Credit evaluation">
              <p className="text-zinc-300">
                Risk Tier: A
              </p>
              <p className="text-zinc-300">
                Risk Score: 78/100
              </p>
            </DrawerSection>
          </DrawerContent>
        </Drawer>
      </div>
    );
  },
};