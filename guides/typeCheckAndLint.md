# TypeScript Type Checking and Linting Fix Workflow

## Overview
This guide provides instructions for iteratively fixing TypeScript type errors and ESLint issues in a project.

## Workflow

### Phase 1: TypeScript Type Checking

1. **Run Type Check**
   - Execute: `npx tsx --type-check` (or `tsc --noEmit` for standard TypeScript projects)
   - This checks for type errors without emitting files

2. **Analyze Errors**
   - Review all type errors reported
   - Group related errors by file and type
   - Prioritize errors that cascade (fixing one may fix many)

3. **Fix Errors Systematically**
   - Address errors file by file, starting with foundational files (types, interfaces, utilities)
   - Common fixes:
     - Add missing type annotations
     - Fix type mismatches
     - Add null/undefined checks
     - Update incorrect type assertions
     - Fix import/export issues
     - Resolve missing dependencies or properties

4. **Repeat**
   - After fixing a batch of errors, run `npx tsx --type-check` again
   - Continue until the command completes with no errors

### Phase 2: Linting

5. **Run Lint Auto-Fix**
   - Execute: `npm run lint --fix`
   - This will automatically fix many formatting and code style issues

6. **Review Remaining Lint Errors**
   - If errors remain after auto-fix, review them
   - Common issues that need manual fixes:
     - Unused variables/imports
     - Complexity issues
     - Accessibility violations
     - React Hooks dependency arrays

7. **Fix Remaining Issues**
   - Address lint errors that couldn't be auto-fixed
   - Run `npm run lint` to verify all issues resolved

8. **Final Verification**
   - Run both checks one final time:
     - `npx tsx --type-check`
     - `npm run lint`
   - Ensure both pass with no errors

## Best Practices

### Type Error Fixing
- Start with errors in dependency/utility files before application code
- Look for patterns in errors - similar issues often appear multiple times
- Consider if types need to be made more flexible (union types, optional properties)
- Don't use `any` as a quick fix - be specific with types

### Lint Error Fixing
- Let auto-fix handle what it can first
- Be careful with unused variable warnings - verify they're truly unused
- Consider if lint rules need adjustment for the project's needs
- Maintain consistency with existing code style

### Iteration Strategy
- Make incremental changes and test frequently
- Group related fixes together in logical batches
- If stuck on an error, skip it and come back after fixing others
- Watch for errors that resolve themselves after fixing dependencies

## Commands Reference

```bash
# TypeScript type checking
npx tsx --type-check
# or
tsc --noEmit

# Linting with auto-fix
npm run lint --fix

# Linting without auto-fix (check only)
npm run lint
```

## Completion Criteria

The workflow is complete when:
1. `npx tsx --type-check` completes with zero errors
2. `npm run lint` completes with zero errors
3. Code builds successfully (if applicable)
4. All fixes maintain existing functionality
