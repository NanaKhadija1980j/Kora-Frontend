import type { Meta, StoryObj } from "@storybook/react";
import { InvoiceMetadataViewer } from "./InvoiceMetadataViewer";
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

const meta: Meta<typeof InvoiceMetadataViewer> = {
  title: "Invoice/InvoiceMetadataViewer",
  component: InvoiceMetadataViewer,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof InvoiceMetadataViewer>;

export const Default: Story = {
  args: {
    invoice: mockInvoice,
    isFunded: false,
  },
};

export const Anonymized: Story = {
  args: {
    invoice: {
      ...mockInvoice,
      debtorPrivacy: "anonymized",
    },
    isFunded: false,
  },
};

export const FundedFullView: Story = {
  args: {
    invoice: {
      ...mockInvoice,
      debtorPrivacy: "anonymized",
    },
    isFunded: true,
  },
};
