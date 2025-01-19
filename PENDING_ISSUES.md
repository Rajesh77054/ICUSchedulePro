
# Pending Issues

## Shift Swap Request Visibility
- **Issue**: Shift swap requests are not visible in recipient's Personal Schedule Dashboard
- **Components Affected**: 
  - PersonalDashboard.tsx
  - SwapRequests.tsx
- **Expected Behavior**: When a shift swap is requested, it should appear in both the requestor's and recipient's dashboards
- **Current Behavior**: Request only shows in requestor's dashboard and Shift Swaps page
- **Related Files**:
  - client/src/pages/PersonalDashboard.tsx
  - client/src/components/scheduler/SwapRequests.tsx
  - server/routes.ts
