# **Requirement Specification Document**

## **Gated Community Financial Management Web Application**

## **1\. Overview**

### **Project Objective**

Develop a web-based financial management application for a gated residential community consisting of **564 apartments** to digitally manage, monitor, and forecast the community's financial operations.

The application will provide transparency and control over:

* Maintenance collections  
* Common utility collections  
* Vendor income  
* Operational expenses  
* Repair expenses  
* Approval-based expenses  
* Cash position  
* Future cash flow forecasting

The system will be designed around four major financial management segments:

1. Account Receivables  
2. Account Payables  
3. Cash Balance (Phase 2\)  
4. Cash Flow Forecasting (Phase 3\)

---

# **2\. User Roles**

## **2.1 Management Committee (MC)**

Responsibilities:

* Review financial transactions  
* Approve large expenses  
* Monitor cash position  
* Review forecasts

## **2.2 Finance/Admin Team**

Responsibilities:

* Upload collections  
* Maintain vendor records  
* Enter expenses  
* Upload invoices  
* Generate reports

## **2.3 Community Members/Residents**

Responsibilities:

* View approved financial information  
* Participate in approval workflows (where applicable)

---

# **3\. Application Modules**

The application will consist of four primary modules/pages:

1. Account Receivables  
2. Account Payables  
3. Cash Balance Dashboard  
4. Cash Flow Forecasting

---

# **Module 1: Account Receivables**

## **Objective**

Manage all incoming money from residents, vendors, and other revenue sources.

---

## **Tab 1: Apartment Maintenance & Common Electricity Collection**

### **Purpose**

Track monthly collections from all 564 apartments.

### **Features**

### **Flat Listing Table**

Display all apartments in table format.

Fields:

| Field | Description |
| ----- | ----- |
| Flat Number | Apartment identification |
| Owner Name | Resident details |
| Maintenance Amount | Monthly maintenance charge |
| Common Electricity Amount | Electricity contribution |
| Due Date | Payment deadline |
| Payment Status | Paid / Pending / Overdue |
| Payment Date | Collection date |
| Amount Received | Received amount |

### **Functional Requirements**

* Import collection data from NBH portal export file  
* Support Excel upload  
* Display collection status  
* Filter by:  
  * Tower  
  * Flat number  
  * Payment status  
  * Month  
* Export data into Excel format  
* Generate pending payment list

---

## **Tab 2: Vendor Income Management**

### **Purpose**

Manage income received from community vendors.

Examples:

* 7AM Supermart rent  
* Daycare centre rent  
* Gym trainer revenue sharing  
* Other commercial activities

### **Features**

Vendor Income Table:

| Field | Description |
| ----- | ----- |
| Vendor Name | Vendor identification |
| Agreement Amount | Monthly expected income |
| Due Date | Payment date |
| Received Amount | Amount received |
| Payment Status | Pending/Paid |
| Remarks | Notes |

Functional Requirements:

* Add new vendor as a table entry  
* Edit vendor details  
* Track monthly collections  
* Export vendor income report

---

# **Module 2: Account Payables**

## **Objective**

Manage all community expenses and payment workflows.

---

# **Tab 1: Planned Monthly Expenses**

## **Purpose**

Manage recurring operational expenses.

Examples:

* Housekeeping  
* Security  
* Electricity  
* AMC contracts  
* Facility maintenance

### **Expense Table**

Fields:

| Field | Description |
| ----- | ----- |
| Expense Category | Type of expense |
| Vendor Name | Service provider |
| Monthly Amount | Expected expense |
| Payment Date | Scheduled date |
| Status | Paid/Pending |
| Invoice | Upload document |

Functional Requirements:

* Create recurring expense entries  
* Auto-generate monthly payable list  
* Track payment completion  
* Upload invoice documents

---

# **Tab 2: Maintenance Expense**

## **Purpose**

Manage smaller repair and maintenance expenses where MC approval is not required.

Examples:

* Plumbing repair  
* Electrical repair  
* Material purchase  
* Minor civil work

### **Features**

Expense Entry:

Fields:

| Field | Description |
| ----- | ----- |
| Expense Title | Description |
| Category | Repair/material/service |
| Vendor | Vendor details |
| Amount | Expense amount |
| Date | Expense date |
| Description | Details |
| Invoice Upload | Attach invoice |

Functional Requirements:

* Define approval threshold amount  
* Expenses below threshold can be directly processed  
* Attach invoice/supporting documents  
* Maintain expense history

---

# **Tab 3: Snag List / Large Repair Tasks**

## **Purpose**

Manage major expenses requiring MC approval.

Examples:

* Major civil repairs  
* Equipment replacement  
* Large maintenance projects

---

## **Workflow**

### **Step 1: Create Snag / Requirement**

Information:

* Issue description  
* Location  
* Priority  
* Estimated cost

---

### **Step 2: Vendor Quotation Collection**

Requirements:

* Upload minimum 3 vendor quotations  
* Store quotation documents  
* Compare quotation values

Quotation Table:

| Vendor | Quote Amount | Document |
| ----- | ----- | ----- |
| Vendor 1 | Amount | PDF |
| Vendor 2 | Amount | PDF |
| Vendor 3 | Amount | PDF |

---

### **Step 3: MC Approval Workflow**

Features:

* Send approval request to MC members  
* Member voting/approval tracking  
* Maintain approval history

Approval Status:

* Pending  
* Approved  
* Rejected

---

### **Step 4: Expense Completion**

After approval:

* Upload final invoice  
* Record payment  
* Close task

---

# **Module 3: Cash Balance Dashboard (Phase 2\)**

## **Objective**

Provide real-time visibility of community financial position.

---

## **Dashboard Requirements**

Display:

### **Current Cash Position**

* Opening balance  
* Total income  
* Total expenses  
* Available balance

---

## **Cash Flow Visualization**

Use Sankey chart representation:

### **Income Sources**

Examples:

* Maintenance collection  
* Electricity collection  
* Vendor income  
* Other income

### **Expense Categories**

Examples:

* Security  
* Housekeeping  
* Electricity  
* Repairs  
* AMC  
* Other expenses

The dashboard should show:

Incoming Cash → Allocation → Remaining Balance

---

# **Module 4: Cash Flow Forecasting (Phase 3\)**

## **Objective**

Predict future financial position based on expected income and expenses.

---

## **Features**

### **Forecast Dashboard**

Display:

* Expected income  
* Planned expenses  
* Upcoming payments  
* Estimated closing balance

---

## **Entry Management**

Ability to add:

### **Future Income**

Examples:

* Expected maintenance collection  
* Vendor payments  
* Other revenue

### **Future Expenses**

Examples:

* Annual maintenance  
* Repairs  
* Projects  
* Contract renewals

---

## **Forecast View**

Timeline:

* Monthly  
* Quarterly  
* Yearly

Reports:

* Expected surplus  
* Expected deficit  
* Cash requirement planning

---

# **4\. Document Management**

System should support:

* Invoice upload  
* Vendor quotations upload  
* Payment proof upload  
* Expense documents

Supported formats:

* PDF  
* Excel  
* Images

---

# **5\. Reporting Requirements**

Reports:

## **Receivable Reports**

* Pending maintenance payments  
* Collection summary  
* Vendor income report

## **Payable Reports**

* Expense summary  
* Category-wise expense  
* Vendor payment report

## **Financial Reports**

* Monthly income vs expense  
* Cash balance report  
* Forecast report

Export formats:

* Excel  
* PDF

I have added the **Authentication & Authorization requirements** section into the SRS format, covering user management, roles, access control, and approval workflows.

# **Module 5: Authentication & Authorization Management**

## **Objective**

Implement a secure role-based authentication and authorization framework to ensure that users have appropriate access based on their responsibilities within the community financial management system.

The system should support:

* Controlled access to financial information  
* Role-based permissions  
* Approval workflows  
* User activity tracking

---

# **5.1 User Authentication**

## **Login Management**

Users should be able to access the application using secure authentication.

Supported requirements:

* Username/email-based login  
* Password authentication  
* Password reset functionality  
* Session management  
* Secure logout

---

# **5.2 User Roles**

The system will support the following primary roles:

---

# **Role 1: System Administrator**

## **Purpose**

Manage users, roles, and system-level configurations.

## **Permissions**

Admin can:

* Create new users  
* Edit user details  
* Activate/deactivate users  
* Assign roles  
* Modify user permissions  
* Reset passwords  
* View user activity logs

Example users:

* Application administrator  
* Community administrator

---

# **Role 2: Management Committee (MC) Member**

## **Purpose**

Review and approve major financial decisions.

## **Permissions**

MC members can:

### **Snag List Approval Workflow**

* View large repair tasks  
* Review vendor quotations  
* Compare quotation details  
* View uploaded documents  
* Approve/reject expenses  
* Add comments during approval

Approval actions:

* Approve  
* Reject  
* Request clarification

System should maintain:

* Approver name  
* Approval date/time  
* Decision  
* Comments

---

# **Role 3: Finance Management (FM) Team**

## **Purpose**

Perform day-to-day financial operations.

## **Permissions**

FM team can:

### **Account Receivables**

* Upload NBH collection reports  
* Update payment status  
* Manage vendor income entries  
* Generate collection reports

### **Account Payables**

* Add planned expenses  
* Add maintenance expenses  
* Upload invoices  
* Create snag list items  
* Upload vendor quotations  
* Update payment status

Restrictions:

* Cannot approve their own submitted expenses  
* Cannot modify approved transactions without authorization

---

# **Role 4: General Resident / Member Access (Phase 2\)**

## **Purpose**

Provide transparency to community residents.

## **Permissions (Optional based on requirement)**

Residents can:

* View approved financial dashboards  
* View approved expense summaries  
* View community financial reports

Restrictions:

* No access to edit transactions  
* No approval rights  
* No access to confidential vendor documents

---

# **5.3 Role-Based Access Control (RBAC)**

The application should implement permission-based access.

Example permission matrix:

| Feature | Admin | MC Member | FM Team | Resident |
| ----- | ----- | ----- | ----- | ----- |
| Manage Users | ✓ | ✕ | ✕ | ✕ |
| View Financial Dashboard | ✓ | ✓ | ✓ | ✓ |
| Upload Collections | ✓ | ✕ | ✓ | ✕ |
| Add Expenses | ✓ | ✕ | ✓ | ✕ |
| Upload Quotations | ✓ | ✕ | ✓ | ✕ |
| Approve Expenses | ✓ | ✓ | ✕ | ✕ |
| View Approval History | ✓ | ✓ | ✓ | Limited |

---

# **5.4 Expense Approval Authorization Workflow**

Applicable for:

* Snag List  
* Large Repair Tasks  
* High-value expenses

Workflow:

FM Team Creates Expense Request

            ↓

Upload Vendor Quotations

            ↓

Submit for MC Approval

            ↓

MC Members Review

            ↓

Approval / Rejection

            ↓

Invoice Upload

            ↓

Payment Completion

---

# **5.5 Approval Rules**

System should support configurable approval rules:

Examples:

* Expense below ₹X → FM team can process directly  
* Expense above ₹X → MC approval required  
* Large projects → Minimum number of MC approvals required

Configuration:

Admin should be able to define:

* Approval threshold amount  
* Required approver count  
* Approval hierarchy

---

# **5.6 Audit Trail (Phase 2\)**

All important actions should be logged.

Audit information:

* User name  
* Role  
* Action performed  
* Date/time  
* Old value  
* New value

Examples:

* Expense created  
* Invoice uploaded  
* Quotation replaced  
* Approval granted  
* Approval rejected

---

# **5.7 User Management Screen**

Admin interface should provide:

User list:

| Field | Description |
| ----- | ----- |
| Name | User name |
| Email | Login ID |
| Role | Assigned role |
| Status | Active/Inactive |
| Last Login | User activity |

Actions:

* Add User  
* Edit User  
* Assign Role  
* Disable Access

---

# **6\. Non Functional Requirements**

## **Security**

* Role-based access control  
* Secure login  
* Audit history for transactions

## **Performance**

System should support:

* 564 apartment records  
* Multiple years of financial transactions  
* Multiple document uploads

## **Usability**

* Responsive web application  
* Simple dashboard-based navigation  
* Easy export and reporting

---

# **Future Enhancements**

Potential future modules:

* Resident mobile application  
* Payment gateway integration  
* Automated reminders  
* Bank statement reconciliation  
* AI-based expense analysis  
* Budget planning module

---

# **Summary**

This application will act as a centralized financial management platform for the gated community, providing transparency, approval control, and predictive financial planning across all community operations.

