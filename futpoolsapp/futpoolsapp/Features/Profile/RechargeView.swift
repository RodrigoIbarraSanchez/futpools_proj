//
//  RechargeView.swift
//  futpoolsapp
//

import SwiftUI
import StoreKit

private let rechargeProductIds: Set<String> = [
    "com.futpools.recharge.50",
    "com.futpools.recharge.100",
    "com.futpools.recharge.200",
    "com.futpools.recharge.500",
]

struct RechargeView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @State private var products: [StoreKit.Product] = []
    @State private var isLoading = true
    @State private var isPurchasing = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                Group {
                    if isLoading && products.isEmpty {
                        ProgressView()
                            .tint(.appPrimary)
                    } else if products.isEmpty {
                        VStack(spacing: AppSpacing.md) {
                            Text("No recharge options available right now.")
                                .font(AppFont.body())
                                .foregroundColor(.appTextSecondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding()
                    } else {
                        ScrollView {
                            VStack(spacing: AppSpacing.sm) {
                                if let msg = successMessage {
                                    Text(msg)
                                        .font(AppFont.caption())
                                        .foregroundColor(.appGreen)
                                }
                                if let msg = errorMessage {
                                    Text(msg)
                                        .font(AppFont.caption())
                                        .foregroundColor(.appLiveRed)
                                }
                                ForEach(products, id: \.id) { product in
                                    RechargeRow(
                                        product: product,
                                        isPurchasing: isPurchasing
                                    ) {
                                        purchase(product)
                                    }
                                }
                            }
                            .padding()
                        }
                    }
                }
            }
            .navigationTitle("Recharge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: { dismiss() })
                        .foregroundColor(.appTextSecondary)
                }
            }
            .task { await loadProducts() }
        }
    }

    private func loadProducts() async {
        isLoading = true
        errorMessage = nil
        do {
            products = try await StoreKit.Product.products(for: rechargeProductIds).sorted { p1, p2 in
                (p1.price as Decimal) < (p2.price as Decimal)
            }
        } catch {
            errorMessage = error.localizedDescription
            products = []
        }
        isLoading = false
    }

    private func purchase(_ product: StoreKit.Product) {
        Task {
            isPurchasing = true
            errorMessage = nil
            successMessage = nil
            do {
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction: StoreKit.Transaction
                    switch verification {
                    case .verified(let t):
                        transaction = t
                    case .unverified:
                        errorMessage = "Purchase could not be verified."
                        isPurchasing = false
                        return
                    }
                    let jws = verification.jwsRepresentation
                    try await auth.rechargeBalance(signedTransaction: jws)
                    await transaction.finish()
                    successMessage = String(localized: "Balance updated. You can close this screen.")
                case .userCancelled:
                    break
                case .pending:
                    successMessage = String(localized: "Purchase is pending approval.")
                @unknown default:
                    break
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isPurchasing = false
        }
    }
}

private struct RechargeRow: View {
    let product: StoreKit.Product
    let isPurchasing: Bool
    let onPurchase: () -> Void

    var body: some View {
        CardView {
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(product.displayName)
                        .font(AppFont.headline())
                        .foregroundColor(.appTextPrimary)
                    Text(product.description)
                        .font(AppFont.caption())
                        .foregroundColor(.appTextSecondary)
                        .lineLimit(2)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                    Text(product.displayPrice)
                        .font(AppFont.headline())
                        .foregroundColor(.appGreen)
                    Button(action: onPurchase) {
                        Text("Buy")
                            .font(AppFont.caption())
                            .foregroundColor(.white)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.sm)
                            .background(Color.appPrimary)
                            .clipShape(Capsule())
                    }
                    .disabled(isPurchasing)
                }
            }
            .padding(AppSpacing.sm)
        }
    }
}

#Preview {
    RechargeView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
