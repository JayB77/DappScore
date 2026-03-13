import { PremiumPurchased } from '../generated/PremiumListings/PremiumListings';
import { Project } from '../generated/schema';

export function handlePremiumPurchased(event: PremiumPurchased): void {
  let projectId = event.params.projectId.toString();
  let project = Project.load(projectId);

  if (project == null) {
    return;
  }

  project.isPremium = true;
  project.premiumExpiresAt = event.params.expiresAt;
  project.save();
}
