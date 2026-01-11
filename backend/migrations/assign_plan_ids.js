/**
 * Database Migration: Assign plan_id to existing users
 * 
 * Purpose: Grandfathers existing users into their current plan version (v1)
 * while new users will get the latest plan version (v2).
 * 
 * This ensures backward compatibility - existing users keep their original
 * plan limits and fee structure.
 * 
 * Run manually: node backend/migrations/assign_plan_ids.js
 * Or via admin endpoint: POST /api/admin/run-migration
 */

import supabase from '../services/supabase.js';

// Plan version mapping based on subscription.plan value
const PLAN_VERSION_MAP = {
    'free': 'free_v1',
    'pro': 'pro_v1', 
    'premium': 'premium_v1',
    'enterprise': 'enterprise_v1'
};

export async function assignPlanIds(options = {}) {
    const { dryRun = false, batchSize = 100 } = options;
    
    console.log('[Migration] Starting plan_id assignment...');
    console.log(`[Migration] Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    
    const results = {
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        details: []
    };
    
    try {
        // Fetch all profiles that don't have a plan_id set
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, email, subscription, created_at')
                .range(offset, offset + batchSize - 1);
            
            if (error) {
                throw new Error(`Failed to fetch profiles: ${error.message}`);
            }
            
            if (!profiles || profiles.length === 0) {
                hasMore = false;
                break;
            }
            
            console.log(`[Migration] Processing batch of ${profiles.length} profiles (offset: ${offset})`);
            
            for (const profile of profiles) {
                results.processed++;
                
                const subscription = profile.subscription || {};
                const currentPlan = subscription.plan || 'free';
                const existingPlanId = subscription.plan_id;
                
                // Skip if already has a plan_id
                if (existingPlanId) {
                    results.skipped++;
                    results.details.push({
                        id: profile.id,
                        email: profile.email,
                        action: 'skipped',
                        reason: `Already has plan_id: ${existingPlanId}`
                    });
                    continue;
                }
                
                // Determine the plan_id based on current plan
                const planId = PLAN_VERSION_MAP[currentPlan] || 'free_v1';
                
                // Prepare updated subscription with plan_id
                const updatedSubscription = {
                    ...subscription,
                    plan_id: planId,
                    grandfathered_at: new Date().toISOString(),
                    original_plan: currentPlan
                };
                
                if (dryRun) {
                    results.updated++;
                    results.details.push({
                        id: profile.id,
                        email: profile.email,
                        action: 'would_update',
                        currentPlan,
                        assignedPlanId: planId
                    });
                } else {
                    // Actually update the profile
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ 
                            subscription: updatedSubscription,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', profile.id);
                    
                    if (updateError) {
                        results.errors.push({
                            id: profile.id,
                            email: profile.email,
                            error: updateError.message
                        });
                    } else {
                        results.updated++;
                        results.details.push({
                            id: profile.id,
                            email: profile.email,
                            action: 'updated',
                            currentPlan,
                            assignedPlanId: planId
                        });
                    }
                }
            }
            
            offset += batchSize;
            
            // Safety check - if we got fewer results than batch size, we're done
            if (profiles.length < batchSize) {
                hasMore = false;
            }
        }
        
        console.log('[Migration] Complete!');
        console.log(`[Migration] Processed: ${results.processed}`);
        console.log(`[Migration] Updated: ${results.updated}`);
        console.log(`[Migration] Skipped: ${results.skipped}`);
        console.log(`[Migration] Errors: ${results.errors.length}`);
        
        return results;
        
    } catch (error) {
        console.error('[Migration] Fatal error:', error);
        results.errors.push({ fatal: true, message: error.message });
        return results;
    }
}

// CLI execution
if (process.argv[1]?.includes('assign_plan_ids')) {
    const dryRun = process.argv.includes('--dry-run');
    
    assignPlanIds({ dryRun })
        .then((results) => {
            console.log('\n=== Migration Results ===');
            console.log(JSON.stringify(results, null, 2));
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

export default assignPlanIds;
