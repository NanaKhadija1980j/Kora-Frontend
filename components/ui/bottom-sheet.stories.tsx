import type { Meta, StoryObj } from '@storybook/react';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { useState } from 'react';

const meta: Meta<typeof BottomSheet> = {
  title: 'UI/BottomSheet',
  component: BottomSheet,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean' },
    title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default bottom sheet with title and content
 */
export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Bottom Sheet</Button>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Bottom Sheet Title"
        >
          <div className="space-y-4">
            <p className="text-zinc-300">
              This is the content of the bottom sheet. It can contain any
              arbitrary content including forms, lists, or other components.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          </div>
        </BottomSheet>
      </div>
    );
  },
};

/**
 * Bottom sheet without a title
 */
export const WithoutTitle: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Bottom Sheet (No Title)</Button>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
        >
          <div className="space-y-4">
            <p className="text-zinc-300">
              This bottom sheet has no title. The drag handle is still available
              for swipe-to-dismiss.
            </p>
            <Button className="w-full" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </BottomSheet>
      </div>
    );
  },
};

/**
 * Bottom sheet with form content
 */
export const WithForm: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Form</Button>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Contact Support"
        >
          <form className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-zinc-300">
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                placeholder="Describe your issue..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>
        </BottomSheet>
      </div>
    );
  },
};

/**
 * Bottom sheet with long scrollable content
 */
export const LongContent: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Long Content</Button>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Terms of Service"
        >
          <div className="space-y-4">
            <div className="prose prose-invert max-w-none">
              <h3 className="text-lg font-semibold text-zinc-100">Section 1</h3>
              <p className="text-zinc-300">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat.
              </p>
              <h3 className="text-lg font-semibold text-zinc-100">Section 2</h3>
              <p className="text-zinc-300">
                Duis aute irure dolor in reprehenderit in voluptate velit esse
                cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
                cupidatat non proident, sunt in culpa qui officia deserunt
                mollit anim id est laborum.
              </p>
              <h3 className="text-lg font-semibold text-zinc-100">Section 3</h3>
              <p className="text-zinc-300">
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem
                accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
                quae ab illo inventore veritatis et quasi architecto beatae
                vitae dicta sunt explicabo.
              </p>
              <h3 className="text-lg font-semibold text-zinc-100">Section 4</h3>
              <p className="text-zinc-300">
                Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit
                aut fugit, sed quia consequuntur magni dolores eos qui ratione
                voluptatem sequi nesciunt.
              </p>
              <h3 className="text-lg font-semibold text-zinc-100">Section 5</h3>
              <p className="text-zinc-300">
                Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet,
                consectetur, adipisci velit, sed quia non numquam eius modi
                tempora incidunt ut labore et dolore magnam aliquam quaerat
                voluptatem.
              </p>
            </div>
            <div className="flex gap-2 border-t border-zinc-800 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Disagree
              </Button>
              <Button onClick={() => setOpen(false)}>Agree</Button>
            </div>
          </div>
        </BottomSheet>
      </div>
    );
  },
};