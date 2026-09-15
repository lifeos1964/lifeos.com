import { showToast } from './utils.js';

const STORAGE_KEY = 'lifeos_plan';
const BILLING_STORAGE_KEY = 'lifeos_billing_cycle';
const YEARLY_DISCOUNT = 0.20;

const PLANS = [
    {
        id: 'free',
        name: 'Free',
        monthlyPrice: 0,
        cadence: 'forever',
        description: 'A calm foundation for everyday planning.',
        features: ['Core dashboard', 'Tasks, goals, and notes', 'Local data storage']
    },
    {
        id: 'plus',
        name: 'Plus',
        monthlyPrice: 6,
        cadence: 'per month',
        description: 'More room for the life you are building.',
        features: ['Everything in Free', 'Travel planning', 'Advanced insights'],
        featured: true
    },
    {
        id: 'pro',
        name: 'Family Pro',
        monthlyPrice: 12,
        cadence: 'per month',
        description: 'One shared life system for the whole household.',
        features: ['Everything in Plus', 'Up to 4 family members', 'Shared family workspace', 'AI planning tools'],
        family: true
    }
];

function getPlanId() {
    return localStorage.getItem(STORAGE_KEY) || 'free';
}

function getBillingCycle() {
    return localStorage.getItem(BILLING_STORAGE_KEY) || 'monthly';
}

function getPlanPrice(plan, billingCycle) {
    if (plan.monthlyPrice === 0) return { price: '$0', cadence: 'forever' };
    if (billingCycle === 'yearly') {
        return { price: `$${(plan.monthlyPrice * 12 * (1 - YEARLY_DISCOUNT)).toFixed(2)}`, cadence: 'per year' };
    }
    return { price: `$${plan.monthlyPrice}`, cadence: 'per month' };
}

export function getFamilyLimit() {
    return getPlanId() === 'pro' ? 4 : 0;
}

function savePlan(planId) {
    localStorage.setItem(STORAGE_KEY, planId);
}

function renderPlanCard(plan, currentPlan, billingCycle) {
    const isCurrent = plan.id === currentPlan;
    const pricing = getPlanPrice(plan, billingCycle);
    return `
        <article class="plan-option ${plan.featured ? 'plan-option-featured' : ''} ${isCurrent ? 'plan-option-current' : ''}">
            ${plan.featured ? '<span class="plan-recommended">Recommended</span>' : ''}
            ${plan.family ? '<span class="plan-family-badge"><i class="fa-solid fa-users"></i> Multi-user</span>' : ''}
            <div class="plan-option-heading">
                <div>
                    <h4>${plan.name}</h4>
                    <p>${plan.description}</p>
                </div>
                <div class="plan-price"><strong>${pricing.price}</strong><span>${pricing.cadence}</span></div>
            </div>
            <ul>${plan.features.map(feature => `<li><i class="fa-solid fa-check"></i>${feature}</li>`).join('')}</ul>
            <button class="${isCurrent ? 'btn-secondary' : 'btn-primary'} plan-select-btn" data-plan="${plan.id}" ${isCurrent ? 'disabled' : ''}>
                ${isCurrent ? 'Current plan' : `Choose ${plan.name}`}
            </button>
        </article>
    `;
}

export function initPlans() {
    const trigger = document.getElementById('plans-trigger');
    const sidebarPlanName = document.getElementById('sidebar-plan-name');
    if (!trigger || !sidebarPlanName) return;

    const updateSidebarPlan = () => {
        const activePlan = PLANS.find(plan => plan.id === getPlanId()) || PLANS[0];
        sidebarPlanName.textContent = `${activePlan.name} plan`;
    };

    const openPlansDialog = () => {
        const currentPlan = getPlanId();
        let billingCycle = getBillingCycle();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card plans-modal-card">
                <div class="modal-header">
                    <div>
                        <span class="eyebrow">LifeOS plans</span>
                        <h3>Choose the space you need</h3>
                    </div>
                    <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <p class="plans-intro">Start free and upgrade when your system grows. Your local data stays with you.</p>
                    <div class="billing-switcher" role="group" aria-label="Billing cycle">
                        <button class="billing-option ${billingCycle === 'monthly' ? 'active' : ''}" data-cycle="monthly" type="button">Monthly</button>
                        <button class="billing-option ${billingCycle === 'yearly' ? 'active' : ''}" data-cycle="yearly" type="button">Yearly <span>Save 20%</span></button>
                    </div>
                    <div class="plans-grid">${PLANS.map(plan => renderPlanCard(plan, currentPlan, billingCycle)).join('')}</div>
                    <p class="plans-footnote"><i class="fa-solid fa-lock"></i> Payments are not connected yet. Plan selection is saved locally for this prototype.</p>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('.close-modal-btn').onclick = close;
        overlay.onclick = event => { if (event.target === overlay) close(); };
        const bindPlanActions = () => {
            overlay.querySelectorAll('.plan-select-btn:not([disabled])').forEach(button => {
                button.onclick = () => {
                    savePlan(button.dataset.plan);
                    localStorage.setItem(BILLING_STORAGE_KEY, billingCycle);
                    updateSidebarPlan();
                    close();
                    showToast(`You are now on the ${button.dataset.plan} plan (${billingCycle}).`);
                };
            });
        };

        overlay.querySelectorAll('.billing-option').forEach(button => {
            button.onclick = () => {
                billingCycle = button.dataset.cycle;
                localStorage.setItem(BILLING_STORAGE_KEY, billingCycle);
                overlay.querySelectorAll('.billing-option').forEach(option => option.classList.toggle('active', option.dataset.cycle === billingCycle));
                overlay.querySelector('.plans-grid').innerHTML = PLANS.map(plan => renderPlanCard(plan, currentPlan, billingCycle)).join('');
                bindPlanActions();
            };
        });

        bindPlanActions();
    };

    trigger.onclick = openPlansDialog;
    updateSidebarPlan();
}

export { getPlanId };
