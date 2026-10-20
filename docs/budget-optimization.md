# YieldWise — Smart Budget Mode Specification & Proof

## Problem Definition
Given a hard grocery budget $B$ in cents, a meal recipe with confirmed ingredients $i \in \{1 \dots n\}$, user-confirmed importance tiers $P_i \in \{\text{essential}, \text{high}, \text{medium}, \text{low}\}$, and discrete grocery packages $j$, find a whole-package purchase vector $x_{ij} \in \{0, 1, \dots, 12\}$ such that:

1. **Essentials Protected**: Every essential ingredient requirement $R_i$ is completely satisfied:
   $$\sum_j x_{ij} u_{ij} \ge R_i \quad \forall i \in E$$
2. **Hard Budget Ceiling**: Total checkout spending cannot exceed budget:
   $$\sum_{i,j} x_{ij} c_{ij} \le B$$
3. **Optional Selection**: For optional ingredients, whole-ingredient requirements are included or omitted:
   $$z_i \in \{0, 1\} \quad \forall i \notin E$$
4. **Lexicographical Objective**: Maximize:
   $$(N_{\text{high}}, N_{\text{medium}}, N_{\text{low}}, -\text{TotalSpent}, -\text{TotalLeftover}, -\text{TotalPackages}, \text{StableIdTieBreak})$$

## Mathematical Independence
Because package purchases are discrete to each ingredient (no cross-ingredient package sharing in the MVP), the minimal cost to fully satisfy ingredient $i$ is independent of other ingredients.

Let $C_i$ be the minimum checkout cost to cover requirement $R_i$:
$$E_{\text{cost}} = \sum_{i \in E} C_i$$

- If $E_{\text{cost}} > B$: The algorithm immediately returns status `essential_over_budget` with shortfall $E_{\text{cost}} - B$.
- If $E_{\text{cost}} \le B$: The available discretionary budget is $B - E_{\text{cost}}$. The solver checks all $2^k$ subsets of optional items ($k \le 12 \implies 2^{12} = 4096$ evaluations), selecting the globally optimal subset that satisfies the lexicographical ranking.

## Result Statuses
- `complete_original_within_budget`: All essential and optional ingredients purchased within budget.
- `adapted_within_budget`: Essentials purchased; one or more optional ingredients omitted due to budget constraints.
- `essential_over_budget`: Minimum essential cost exceeds budget; exact shortfall provided.
- `blocked_missing_input`: Missing package price, yield factor, or unverified requirement.
- `out_of_solver_limits`: Requirement exceeds maximum allowable package search bound.
