//
//  Picker.swift
//  futpoolsapp
//
//  Lightweight API-shaped models used to render team/league picker
//  results across the app. Originally lived inside the deleted
//  CreatePool feature; OnboardingState still uses them for the
//  custom-team / custom-league dictionaries persisted during the
//  onboarding flow.
//

import Foundation

struct PickerLeague: Decodable, Identifiable, Equatable, Hashable {
    let id: Int
    let name: String
    let logo: String?
    let country: String?
    let season: Int?
}

struct PickerTeam: Decodable, Identifiable, Equatable, Hashable {
    let id: Int
    let name: String
    let logo: String?
    let country: String?
}
