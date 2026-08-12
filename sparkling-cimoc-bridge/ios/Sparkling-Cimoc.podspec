require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'Sparkling-Cimoc'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.authors        = package['author']
  s.homepage       = 'https://github.com/tiktok/sparkling'
  s.platforms      = {
    :ios => '12.0'
  }
  s.swift_version  = '5.7'
  s.source         = { git: 'https://github.com/tiktok/sparkling.git', tag: s.version.to_s, path: 'packages/methods/sparkling-cimoc-bridge/ios' }
  s.static_framework = true

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.subspec 'Core' do |core|
    core.source_files = [
      'Sources/Core/Methods/**/*.{h,m,swift}',
    ]
  end

  s.dependency 'SparklingMethod/Core'
end
