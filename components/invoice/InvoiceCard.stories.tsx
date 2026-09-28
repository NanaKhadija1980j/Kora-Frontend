import type { Meta, StoryObj } from "@storybook/react";
import { InvoiceCard, InvoiceCardSkeleton } from "./InvoiceCard";
import type { Invoice } from "@/types";

const mockInvoice: Invoice = {
  id: "inv-001",
  tokenId: "tok-001",
  contractAddress: "GABC1234CONTRACTADDRESS",
  ipfsCid: "QmExampleCid",
  metadata: {
    invoiceNumber: "INV-2024-001",
    issuerName: "Acme Corp Ltd",
    issuerAddress: "GISSUER1234",
    debtorName: "Global Buyers Inc",
    debtorAddress: "123 Business Way, New York, NY 10001",
    amount: 50000,
    currency: "USDC",
    issueDate: "2024-01-15T00:00:00Z",
    dueDate: "2024-07-15T00:00:00Z",
    description: "Technology services invoice Q1 2024",
    jurisdiction: "US",
    category: "technology",
    documentHash: "QmDocHash",
    documentUrl: "https://ipfs.io/ipfs/QmDocHash",
  },
  terms: {
    discountRate: 0.06,
    apr: 14.5,
    financingAmount: 47000,
    minInvestment: 1000,
    maxInvestment: 10000,
    tenor: 180,
    repaymentDate: "2024-07-15T00:00:00Z",
  },
  funding: {
    totalRaised: 23500,
    targetAmount: 47000,
    fundingProgress: 0.5,
    investorCount: 4,
    remainingCapacity: 23500,
  },
  riskTier: "A",
  riskScore: 82,
  debtorPrivacy: "full",
  status: "partially_funded",
  createdAt: "2024-01-10T00:00:00Z",
  updatedAt: "2024-01-16T00:00:00Z",
  ownerAddress: "GOWNER1234",
};

const meta: Meta<typeof InvoiceCard> = {
  title: "Invoice/InvoiceCard",
  component: InvoiceCard,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof InvoiceCard>;

export const PartiallyFunded: Story = {
  args: {
    invoice: mockInvoice,
    index: 0,
  },
};

export const Listed: Story = {
  args: {
    invoice: {
      ...mockInvoice,
      status: "listed",
      funding: {
        ...mockInvoice.funding,
        totalRaised: 0,
        fundingProgress: 0,
        investorCount: 0,
        remainingCapacity: 47000,
      },
    },
    index: 1,
  },
};

export const FullyFunded: Story = {
  args: {
    invoice: {
      ...mockInvoice,
      status: "fully_funded",
      funding: {
        ...mockInvoice.funding,
        totalRaised: 47000,
        fundingProgress: 1.0,
        investorCount: 8,
        remainingCapacity: 0,
      },
    },
    index: 2,
  },
};

export const Repaid: Story = {
  args: {
    invoice: {
      ...mockInvoice,
      status: "repaid",
      riskTier: "AAA",
    },
    index: 3,
  },
};

export const SkeletonState: Story = {
  render: () => <InvoiceCardSkeleton />,
};
